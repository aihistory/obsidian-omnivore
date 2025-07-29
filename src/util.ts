import { Highlight } from '@omnivore-app/api'
import { diff_match_patch } from 'diff-match-patch'
import { DateTime } from 'luxon'
import escape from 'markdown-escape'
import { parseYaml } from 'obsidian'
import outOfCharacter from 'out-of-character'
import { HighlightColorMapping, HighlightManagerId } from './settings'
import TurndownService from 'turndown'

export const DATE_FORMAT_W_OUT_SECONDS = "yyyy-MM-dd'T'HH:mm"
export const DATE_FORMAT = `${DATE_FORMAT_W_OUT_SECONDS}:ss`
export const REPLACEMENT_CHAR = '-'
// On Unix-like systems / is reserved and <>:"/\|?* as well as non-printable characters \u0000-\u001F on Windows
// credit: https://github.com/sindresorhus/filename-reserved-regex
// eslint-disable-next-line no-control-regex
export const ILLEGAL_CHAR_REGEX_FILE = /[<>:"/\\|?*\u0000-\u001F]/g
export const ILLEGAL_CHAR_REGEX_FOLDER = /[<>:"\\|?*\u0000-\u001F]/g

export interface HighlightPoint {
  left: number
  top: number
}

export interface HighlightRenderOption {
  highlightManagerId: HighlightManagerId
  highlightColor: string
}

export const getHighlightLocation = (patch: string | null): number => {
  if (!patch) {
    return 0
  }
  const dmp = new diff_match_patch()
  const patches = dmp.patch_fromText(patch)
  return patches[0].start1 || 0
}

export const getHighlightPoint = (patch: string | null): HighlightPoint => {
  if (!patch) {
    return { left: 0, top: 0 }
  }
  const { bbox } = JSON.parse(patch) as { bbox: number[] }
  if (!bbox || bbox.length !== 4) {
    return { left: 0, top: 0 }
  }
  return { left: bbox[0], top: bbox[1] }
}

export const compareHighlightsInFile = (a: Highlight, b: Highlight): number => {
  // get the position of the highlight in the file
  const highlightPointA = getHighlightPoint(a.patch)
  const highlightPointB = getHighlightPoint(b.patch)
  if (highlightPointA.top === highlightPointB.top) {
    // if top is same, sort by left
    return highlightPointA.left - highlightPointB.left
  }
  // sort by top
  return highlightPointA.top - highlightPointB.top
}

export const markdownEscape = (text: string): string => {
  try {
    return escape(text)
  } catch (e) {
    console.error('markdownEscape error', e)
    return text
  }
}

export const escapeQuotationMarks = (text: string): string => {
  return text.replace(/"/g, '\\"')
}

export const parseDateTime = (str: string): DateTime => {
  const res = DateTime.fromFormat(str, DATE_FORMAT)
  if (res.isValid) {
    return res
  }
  return DateTime.fromFormat(str, DATE_FORMAT_W_OUT_SECONDS)
}

export const wrapAround = (value: number, size: number): number => {
  return ((value % size) + size) % size
}

export const unicodeSlug = (str: string, savedAt: string) => {
  return (
    str
      .normalize('NFKD') // using NFKD method returns the Unicode Normalization Form of a given string.
      .replace(/[\u0300-\u036f]/g, '') // remove all previously split accents
      .trim()
      .toLowerCase()
      .replace(
        /[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g,
        '',
      ) // replace all the symbols with -
      .replace(/\s+/g, '-') // collapse whitespace and replace by -
      .replace(/_/g, '-') // replace _ with -
      .replace(/-+/g, '-') // collapse dashes
      // remove trailing -
      .replace(/-$/g, '')
      .substring(0, 64) +
    '-' +
    new Date(savedAt).getTime().toString(16)
  )
}

export const replaceIllegalCharsFile = (str: string): string => {
  return removeInvisibleChars(
    str.replace(ILLEGAL_CHAR_REGEX_FILE, REPLACEMENT_CHAR),
  )
}

export const replaceIllegalCharsFolder = (str: string): string => {
  return removeInvisibleChars(
    str.replace(ILLEGAL_CHAR_REGEX_FOLDER, REPLACEMENT_CHAR),
  )
}

export function formatDate(date: string, format: string): string {
  if (isNaN(Date.parse(date))) {
    throw new Error(`Invalid date: ${date}`)
  }
  return DateTime.fromJSDate(new Date(date)).toFormat(format)
}

export const getQueryFromFilter = (filter: string): string => {
  switch (filter) {
    case 'ALL':
      return 'in:all'
    case 'HIGHLIGHTS':
      return `in:all has:highlights`
    case 'ARCHIVED':
      return `in:archive`
    case 'LIBRARY':
      return `in:library`
    default:
      return 'in:all'
  }
}

export const siteNameFromUrl = (originalArticleUrl: string): string => {
  try {
    return new URL(originalArticleUrl).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const wrapHighlightMarkup = (
  quote: string,
  highlightRenderOption: HighlightRenderOption,
): string => {
  const { highlightManagerId, highlightColor } = highlightRenderOption

  const markupRender = (content: string) => {
    if (content.trim().length === 0) {
      return ''
    }
    if (highlightManagerId == HighlightManagerId.HIGHLIGHTR) {
      return `<mark class="${highlightManagerId}-${highlightColor}">${content}</mark>`
    } else {
      return `<mark class="${highlightManagerId} ${highlightManagerId}-${highlightColor}">${content}</mark>`
    }
  }

  return quote.replaceAll(/(>)?(.+)$/gm, (_, g1, g2) => {
    return (g1 ?? '') + markupRender(g2)
  })
}

export const formatHighlightQuote = (
  quote: string | null,
  template: string,
  highlightRenderOption: HighlightRenderOption | null,
): string => {
  if (!quote) {
    return ''
  }
  // if the template has highlights, we need to preserve paragraphs
  const regex = /{{#highlights}}(\n)*>/gm
  if (regex.test(template)) {
    // replace all empty lines with blockquote '>' to preserve paragraphs
    quote = quote.replaceAll('&gt;', '>').replaceAll(/\n/gm, '\n> ')
  }
  if (highlightRenderOption != null) {
    quote = wrapHighlightMarkup(quote, highlightRenderOption)
  }

  return quote
}

export const findFrontMatterIndex = (
  frontMatter: any[],
  id: string,
): number => {
  // find index of front matter with matching id
  return frontMatter.findIndex((fm) => fm.id == id)
}

export const parseFrontMatterFromContent = (content: string) => {
  // get front matter yaml from content
  const frontMatter = content.match(/^---\n(.*?)\n---/s)
  if (!frontMatter) {
    return undefined
  }
  // parse yaml
  return parseYaml(frontMatter[1])
}

export const removeFrontMatterFromContent = (content: string): string => {
  const frontMatterRegex = /^---.*?---\n*/s

  return content.replace(frontMatterRegex, '')
}

export const snakeToCamelCase = (str: string) =>
  str.replace(/(_[a-z])/g, (group) => group.toUpperCase().replace('_', ''))

const removeInvisibleChars = (str: string): string => {
  return outOfCharacter.replace(str)
}

export const setOrUpdateHighlightColors = (
  colorSetting: HighlightColorMapping,
) => {
  const root = document.documentElement

  Object.entries(colorSetting).forEach(([k, v]) => {
    root.style.setProperty(`--omni-${k}`, v)
  })
}

// HTML 到 Markdown 转换器
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
  strongDelimiter: '**',
})

// 配置 Turndown 以处理 Omnivore 特有的标签
turndownService.addRule('omnivoreCleanup', {
  filter: function (node) {
    const element = node as HTMLElement
    return element.hasAttribute && (
      element.hasAttribute('data-omnivore-anchor-idx') ||
      element.hasAttribute('data-omnivore-original-src') ||
      element.hasAttribute('data-src') ||
      element.hasAttribute('data-ratio') ||
      element.hasAttribute('data-s') ||
      element.hasAttribute('data-w') ||
      element.hasAttribute('data-original-style') ||
      element.hasAttribute('data-index') ||
      element.hasAttribute('data-report-img-idx') ||
      element.hasAttribute('data-fail') ||
      element.hasAttribute('data-trans_state') ||
      element.hasAttribute('data-verify_state') ||
      element.hasAttribute('data-pm-slice') ||
      element.hasAttribute('nodeleaf') ||
      element.hasAttribute('leaf') ||
      element.hasAttribute('textstyle') ||
      element.hasAttribute('data-selectable-paragraph') ||
      element.hasAttribute('aria-label') ||
      element.hasAttribute('role') ||
      element.hasAttribute('tabindex') ||
      element.hasAttribute('loading') ||
      element.hasAttribute('style')
    )
  },
  replacement: function (content) {
    return content
  }
})

// 清理 Omnivore 特有的 div 包装
turndownService.addRule('omnivoreDivCleanup', {
  filter: function (node) {
    const element = node as HTMLElement
    return element.nodeName === 'DIV' && (
      element.id === 'readability-content' ||
      element.id === 'readability-page-1' ||
      element.className === 'page'
    )
  },
  replacement: function (content) {
    return content
  }
})

// 处理图片标签，保留 src 属性
turndownService.addRule('omnivoreImages', {
  filter: 'img',
  replacement: function (content, node) {
    const element = node as HTMLElement
    const src = element.getAttribute('src') || element.getAttribute('data-src') || element.getAttribute('data-omnivore-original-src')
    const alt = element.getAttribute('alt') || ''
    if (src) {
      return `![${alt}](${src})`
    }
    return ''
  }
})

// 处理 figure 标签，提取图片和说明
turndownService.addRule('figure', {
  filter: 'figure',
  replacement: function (content, node) {
    const element = node as HTMLElement
    const figcaption = element.querySelector('figcaption')
    const img = element.querySelector('img')
    
    let result = ''
    if (img) {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-omnivore-original-src')
      const alt = img.getAttribute('alt') || ''
      if (src) {
        result += `![${alt}](${src})\n\n`
      }
    }
    
    if (figcaption) {
      result += figcaption.textContent?.trim() + '\n\n'
    }
    
    return result
  }
})

// 处理 picture 标签，提取最佳图片
turndownService.addRule('picture', {
  filter: 'picture',
  replacement: function (content, node) {
    const element = node as HTMLElement
    const img = element.querySelector('img')
    
    if (img) {
      const src = img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-omnivore-original-src')
      const alt = img.getAttribute('alt') || ''
      if (src) {
        return `![${alt}](${src})`
      }
    }
    
    return ''
  }
})

// 处理音频标签
turndownService.addRule('omnivoreAudio', {
  filter: function (node) {
    return node.nodeName === 'MP-COMMON-MPAUDIO'
  },
  replacement: function (content, node) {
    const element = node as HTMLElement
    const name = element.getAttribute('name') || '音频'
    const author = element.getAttribute('author') || ''
    const playLength = element.getAttribute('play_length') || ''
    return `🎵 **${name}**${author ? ` - ${author}` : ''}${playLength ? ` (${playLength})` : ''}`
  }
})

// 移除默认的段落、代码相关规则，使用自定义规则
turndownService.remove('p')
turndownService.remove('pre')
turndownService.remove('code')

// 处理段落标签，确保段落之间有适当的间距
turndownService.addRule('paragraphs', {
  filter: 'p',
  replacement: function (content) {
    return content.trim() + '\n\n'
  }
})

// 处理标题标签，确保标题之间有适当的间距
turndownService.addRule('headings', {
  filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  replacement: function (content, node) {
    const element = node as HTMLElement
    const level = parseInt(element.tagName.charAt(1))
    const prefix = '#'.repeat(level)
    return `\n\n${prefix} ${content.trim()}\n\n`
  }
})

// 处理引用块，确保格式正确
turndownService.addRule('blockquote', {
  filter: 'blockquote',
  replacement: function (content) {
    const lines = content.trim().split('\n')
    const quotedLines = lines.map(line => line.trim() ? `> ${line.trim()}` : '>')
    return quotedLines.join('\n') + '\n\n'
  }
})

// 合并连续的代码块 - 改进版本，跳过<pre>标签
function mergeCodeBlocks(html: string): string {
  // 首先保护<pre>标签，不让它们被段落分割影响
  const preBlocks: string[] = [];
  let protectedHtml = html.replace(/<pre[^>]*>.*?<\/pre>/gs, (match) => {
    const index = preBlocks.length;
    preBlocks.push(match);
    return `__PRE_BLOCK_${index}__`;
  });
  
  // 将HTML按段落分割
  const paragraphs = protectedHtml.split('</p>');
  const mergedParagraphs: string[] = [];
  let currentCodeBlock: string[] = [];
  let inCodeBlock = false;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    if (!paragraph.trim()) continue;
    
    // 检查是否包含被保护的<pre>块
    if (paragraph.includes('__PRE_BLOCK_')) {
      // 如果有未完成的代码块，先结束它
      if (inCodeBlock) {
        const codeText = currentCodeBlock.join('\n');
        const language = detectLanguage(codeText);
        mergedParagraphs.push(`<div class="merged-code-block" data-language="${language}">${codeText}</div>`);
        currentCodeBlock = [];
        inCodeBlock = false;
      }
      
      // 恢复<pre>块并直接添加
      const restoredParagraph = paragraph.replace(/__PRE_BLOCK_(\d+)__/g, (match, index) => {
        return preBlocks[parseInt(index)];
      });
      mergedParagraphs.push(restoredParagraph + (paragraph.endsWith('</p>') ? '' : '</p>'));
      continue;
    }
    
    // 提取段落内容，保持原始格式
    const content = paragraph.replace(/<p[^>]*>/, '');
    const trimmedContent = content.trim();
    
    // 检查是否为空段落（可能是代码块之间的分隔）
    if (!trimmedContent && inCodeBlock) {
      // 如果在代码块中遇到空段落，检查接下来几个段落是否也是代码
      let foundMoreCode = false;
      for (let j = i + 1; j < Math.min(i + 3, paragraphs.length); j++) {
        const nextParagraph = paragraphs[j];
        if (nextParagraph && nextParagraph.trim() && !nextParagraph.includes('__PRE_BLOCK_')) {
          const nextContent = nextParagraph.replace(/<p[^>]*>/, '').trim();
          if (isCodeLike(nextContent)) {
            foundMoreCode = true;
            break;
          } else if (nextContent) {
            // 遇到非空的非代码内容，停止查找
            break;
          }
        }
      }
      
      if (foundMoreCode) {
        // 下面还有代码，跳过这个空段落
        continue;
      }
    }
    
    if (isCodeLike(trimmedContent)) {
      // 这是一个代码段落
      if (!inCodeBlock) {
        // 开始新的代码块
        inCodeBlock = true;
        currentCodeBlock = [content]; // 保持原始格式，包括缩进
      } else {
        // 继续当前代码块
        currentCodeBlock.push(content); // 保持原始格式，包括缩进
      }
    } else {
      // 这不是代码段落
      if (inCodeBlock) {
        // 结束当前代码块
        const codeText = currentCodeBlock.join('\n');
        const language = detectLanguage(codeText);
        // 保持原始格式，不进行额外的格式化
        mergedParagraphs.push(`<div class="merged-code-block" data-language="${language}">${codeText}</div>`);
        currentCodeBlock = [];
        inCodeBlock = false;
      }
      
      // 只有在内容不为空时才添加普通段落
      if (trimmedContent) {
        mergedParagraphs.push(paragraph + '</p>');
      }
    }
  }
  
  // 处理最后的代码块
  if (inCodeBlock && currentCodeBlock.length > 0) {
    const codeText = currentCodeBlock.join('\n');
    const language = detectLanguage(codeText);
    // 保持原始格式，不进行额外的格式化
    mergedParagraphs.push(`<div class="merged-code-block" data-language="${language}">${codeText}</div>`);
  }
  
  return mergedParagraphs.join('');
}

// 处理Omnivore的<pre>代码块 - 最高优先级
turndownService.addRule('omnivorePreBlocks', {
  filter: function (node) {
    return node.nodeType === 1 && node.tagName === 'PRE';
  },
  replacement: function (content, node) {
    const element = node as HTMLElement;
    let htmlContent = element.innerHTML || '';
    
    // 处理复杂的<pre>结构，保持原始换行和缩进
    // 首先处理多个<code>标签之间的分隔
    htmlContent = htmlContent.replace(/<\/code>\s*<code[^>]*>/gi, '\n');
    
    // 将<br>标签转换为换行符
    htmlContent = htmlContent.replace(/<br[^>]*>/gi, '\n');
    
    // 移除HTML标签，但保持文本内容和换行
    htmlContent = htmlContent.replace(/<[^>]*>/g, '');
    
    // 处理HTML实体，但保持原始的空格和换行结构
    htmlContent = htmlContent
      .replace(/&nbsp;/g, ' ')                    // 将&nbsp;转换为普通空格
      .replace(/&lt;/g, '<')                     // 将&lt;转换为<
      .replace(/&gt;/g, '>')                     // 将&gt;转换为>
      .replace(/&amp;/g, '&')                    // 将&amp;转换为&
      .replace(/&quot;/g, '"')                   // 将&quot;转换为"
      .replace(/&#39;/g, "'");                   // 将&#39;转换为'
    
    if (!htmlContent.trim()) return '';
    
    // 保持原始换行结构，只清理每行的末尾空白
    const cleanedText = htmlContent
      .split('\n')                        // 按行分割
      .map(line => line.trimEnd())        // 移除每行末尾空白，但保留开头空格（缩进）
      .join('\n')                         // 重新连接，保持所有原始换行
      .trim();                            // 只移除整体的首尾空白
    
    // 检测代码语言
    const language = detectLanguage(cleanedText);
    
    return `\n\n\`\`\`${language}\n${cleanedText}\n\`\`\`\n\n`;
  }
});

// 已移除合并代码块和增强代码块规则
// 现在只有<pre>标签中的内容会被识别为代码块
// 所有其他内容都将保持为普通文本

// 格式化代码，保持原有的缩进和换行
function formatCode(text: string, language: string): string {
  if (language === 'json') {
    try {
      // 解析JSON并重新格式化
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
      // 如果解析失败，尝试保持原有格式
      return text;
    }
  }
  
  // 对于其他语言，保持原有格式
  return text;
}

// 检测代码语言类型 - 改进版本，优先检测Python
function detectLanguage(text: string): string {
  if (!text || text.trim().length === 0) {
    return '';
  }

  const trimmedText = text.trim();

  // 首先检测Python代码 - 最高优先级
  const pythonPatterns = [
    /def\s+\w+\s*\(/,
    /class\s+\w+\s*[\(:]/, 
    /^(import|from)\s+\w+/m,
    /^(if|for|while|try|with)\s+.*:/m,
    /if\s+__name__\s*==\s*['"]__main__['"]/,
    /print\s*\(/,
    /return\s+/,
    /except\s*[:]/,
    /finally\s*:/,
    /lambda\s+.*:/,
    /yield\s+/,
    /async\s+def/,
    /await\s+/,
    /@\w+/,  // 装饰器
    /@field_validator/,
    /:\s*(str|int|float|bool|List|Dict|Any|Optional)/,  // 类型注解
    /BaseModel/,  // Pydantic
    /\.get\(/,  // requests.get
    /\.raise_for_status\(/,
  ];

  if (pythonPatterns.some(pattern => pattern.test(trimmedText))) {
    return 'python';
  }

  // 检查Python关键字组合
  const pythonKeywords = ['def ', 'class ', 'import ', 'from ', 'return ', 'print(', 
                         'try:', 'except', 'lambda ', 'yield ', 'with ', 'assert ', 
                         'raise ', 'finally:', 'elif ', 'pass', 'break', 'continue',
                         'requests.', 'response.', 'document_', 'load_document'];
  const pythonKeywordCount = pythonKeywords.filter(keyword => trimmedText.includes(keyword)).length;
  
  if (pythonKeywordCount >= 1) {
    return 'python';
  }

  // 尝试解析JSON
  try {
    JSON.parse(trimmedText);
    return 'json';
  } catch (e) {
    // 不是有效的JSON，继续检测其他语言
  }

  // 检测JavaScript/TypeScript代码
  if (trimmedText.includes('function ') || trimmedText.includes('const ') || trimmedText.includes('let ') || 
      trimmedText.includes('var ') || trimmedText.includes('=>') || trimmedText.includes('import ') ||
      trimmedText.includes('export ') || trimmedText.includes('class ') || trimmedText.includes('extends ') ||
      trimmedText.includes('interface ') || trimmedText.includes('type ') || trimmedText.includes('enum ') ||
      trimmedText.includes('async ') || trimmedText.includes('await ') || trimmedText.includes('Promise') ||
      trimmedText.includes('console.log') || trimmedText.includes('document.') || trimmedText.includes('window.')) {
    return trimmedText.includes('interface ') || trimmedText.includes('type ') || trimmedText.includes('enum ') ? 'typescript' : 'javascript';
  }

  // 检测Docker命令
  if (trimmedText.includes('docker run') || trimmedText.includes('docker build') || 
      trimmedText.includes('docker pull') || trimmedText.includes('docker push') ||
      trimmedText.includes('docker-compose') || trimmedText.includes('FROM ') ||
      (trimmedText.includes('-p ') && trimmedText.includes(':')) ||
      (trimmedText.includes('-e ') && trimmedText.includes('='))) {
    return 'bash';
  }

  // 检测Bash/Shell脚本
  if (trimmedText.includes('#!/bin/bash') || trimmedText.includes('#!/bin/sh') || trimmedText.includes('#!/usr/bin/env') ||
      trimmedText.includes('echo ') || trimmedText.includes('cd ') || trimmedText.includes('ls ') || trimmedText.includes('cp ') ||
      trimmedText.includes('mv ') || trimmedText.includes('rm ') || trimmedText.includes('mkdir ') || trimmedText.includes('chmod ') ||
      trimmedText.includes('grep ') || trimmedText.includes('sed ') || trimmedText.includes('awk ') || trimmedText.includes('curl ') ||
      trimmedText.includes('wget ') || trimmedText.includes('ssh ') || trimmedText.includes('scp ') || trimmedText.includes('tar ') ||
      trimmedText.includes('if [') || trimmedText.includes('then') || trimmedText.includes('fi') || trimmedText.includes('for ') ||
      trimmedText.includes('while ') || trimmedText.includes('do') || trimmedText.includes('done') || trimmedText.includes('case ') ||
      trimmedText.includes('esac') || trimmedText.includes('function ') || trimmedText.includes('export ') || trimmedText.includes('source ') ||
      trimmedText.includes('pip install') || trimmedText.includes('npm install') || trimmedText.includes('yarn add') ||
      trimmedText.includes('apt-get') || trimmedText.includes('yum install') || trimmedText.includes('brew install')) {
    return 'bash';
  }

  // 检测INI配置文件
  if (trimmedText.includes('[') && trimmedText.includes(']') && (trimmedText.includes('=') || trimmedText.includes(':')) &&
      !trimmedText.includes('{') && !trimmedText.includes('}') && !trimmedText.includes('function') && !trimmedText.includes('def ')) {
    return 'ini';
  }

  // 检测YAML
  if (trimmedText.includes(':') && (trimmedText.includes('- ') || trimmedText.includes('  ')) && 
      !trimmedText.includes('{') && !trimmedText.includes('}') && !trimmedText.includes('function') && !trimmedText.includes('def ')) {
    return 'yaml';
  }

  // 检测SQL
  if (trimmedText.includes('SELECT ') || trimmedText.includes('INSERT ') || trimmedText.includes('UPDATE ') || 
      trimmedText.includes('DELETE ') || trimmedText.includes('CREATE ') || trimmedText.includes('DROP ') ||
      trimmedText.includes('ALTER ') || trimmedText.includes('FROM ') || trimmedText.includes('WHERE ') ||
      trimmedText.includes('JOIN ') || trimmedText.includes('GROUP BY ') || trimmedText.includes('ORDER BY ') ||
      trimmedText.includes('HAVING ') || trimmedText.includes('UNION ') || trimmedText.includes('INNER JOIN ') ||
      trimmedText.includes('LEFT JOIN ') || trimmedText.includes('RIGHT JOIN ')) {
    return 'sql';
  }

  // 检测HTML
  if (trimmedText.includes('<') && trimmedText.includes('>') && 
      (trimmedText.includes('<div') || trimmedText.includes('<p') || trimmedText.includes('<span') || 
       trimmedText.includes('<a') || trimmedText.includes('<img') || trimmedText.includes('<ul') || 
       trimmedText.includes('<li') || trimmedText.includes('<table') || trimmedText.includes('<tr') || 
       trimmedText.includes('<td') || trimmedText.includes('<th') || trimmedText.includes('<form') || 
       trimmedText.includes('<input') || trimmedText.includes('<button') || trimmedText.includes('<script') || 
       trimmedText.includes('<style') || trimmedText.includes('<link') || trimmedText.includes('<meta'))) {
    return 'html';
  }

  // 检测CSS
  if (trimmedText.includes('{') && trimmedText.includes('}') && 
      (trimmedText.includes('color:') || trimmedText.includes('background:') || trimmedText.includes('margin:') || 
       trimmedText.includes('padding:') || trimmedText.includes('border:') || trimmedText.includes('font:') || 
       trimmedText.includes('display:') || trimmedText.includes('position:') || trimmedText.includes('width:') || 
       trimmedText.includes('height:') || trimmedText.includes('text-align:') || trimmedText.includes('float:') || 
       trimmedText.includes('clear:') || trimmedText.includes('overflow:') || trimmedText.includes('z-index:') || 
       trimmedText.includes('opacity:') || trimmedText.includes('transform:') || trimmedText.includes('transition:') || 
       trimmedText.includes('animation:') || trimmedText.includes('@media') || trimmedText.includes('@keyframes'))) {
    return 'css';
  }

  // 检测XML
  if (trimmedText.includes('<') && trimmedText.includes('>') && trimmedText.includes('<?xml') || 
      (trimmedText.includes('<') && trimmedText.includes('>') && trimmedText.includes('</') && 
       !trimmedText.includes('function') && !trimmedText.includes('def ') && !trimmedText.includes('SELECT '))) {
    return 'xml';
  }

  // 检测Markdown
  if (trimmedText.includes('# ') || trimmedText.includes('## ') || trimmedText.includes('### ') || 
      trimmedText.includes('**') || trimmedText.includes('*') || trimmedText.includes('`') || 
      trimmedText.includes('[') && trimmedText.includes('](') || trimmedText.includes('![') || 
      trimmedText.includes('> ') || trimmedText.includes('- ') || trimmedText.includes('1. ')) {
    return 'markdown';
  }

  // 检测Dockerfile
  if (trimmedText.includes('FROM ') || trimmedText.includes('RUN ') || trimmedText.includes('CMD ') || 
      trimmedText.includes('ENTRYPOINT ') || trimmedText.includes('COPY ') || trimmedText.includes('ADD ') ||
      trimmedText.includes('ENV ') || trimmedText.includes('EXPOSE ') || trimmedText.includes('VOLUME ') ||
      trimmedText.includes('WORKDIR ') || trimmedText.includes('USER ') || trimmedText.includes('ARG ')) {
    return 'dockerfile';
  }

  // 检测Git配置
  if (trimmedText.includes('[user]') || trimmedText.includes('[core]') || trimmedText.includes('[remote') || 
      trimmedText.includes('[branch') || trimmedText.includes('[alias]') || trimmedText.includes('[credential]') ||
      trimmedText.includes('name = ') || trimmedText.includes('email = ') || trimmedText.includes('url = ')) {
    return 'gitconfig';
  }

  // 如果包含大括号，可能是JSON或其他结构化数据
  if (trimmedText.includes('{') && trimmedText.includes('}')) {
    return 'json';
  }

  // 默认返回空字符串（无语言标识）
  return '';
}

// 检查是否是自然语言文本 - 更严格的检测
function isNaturalLanguage(text: string): boolean {
  // 检查是否包含大量常见英文单词
  const commonWords = [
    'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
    'below', 'between', 'among', 'this', 'that', 'these', 'those', 'is', 'are', 'was',
    'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
    'would', 'could', 'should', 'may', 'might', 'must', 'can', 'shall', 'not', 'no',
    'yes', 'all', 'any', 'each', 'every', 'some', 'many', 'much', 'more', 'most',
    'other', 'another', 'such', 'what', 'which', 'who', 'when', 'where', 'why', 'how',
    'ask', 'have', 'then', 'let', 'you', 'it', 'make', 'get', 'see', 'know', 'take',
    'come', 'think', 'look', 'want', 'give', 'use', 'find', 'tell', 'ask', 'work',
    'seem', 'feel', 'try', 'leave', 'call', 'good', 'new', 'first', 'last', 'long',
    'great', 'little', 'own', 'other', 'old', 'right', 'big', 'high', 'different',
    'small', 'large', 'next', 'early', 'young', 'important', 'few', 'public', 'bad',
    'also', 'just', 'only', 'still', 'even', 'well', 'way', 'back', 'out', 'over',
    'again', 'down', 'here', 'there', 'now', 'then', 'very', 'too', 'so', 'really',
    'because', 'while', 'since', 'although', 'however', 'therefore', 'moreover',
    'furthermore', 'nevertheless', 'meanwhile', 'instead', 'otherwise', 'thus',
    'hence', 'consequently', 'accordingly', 'indeed', 'certainly', 'obviously',
    'clearly', 'particularly', 'especially', 'specifically', 'generally', 'usually',
    'often', 'sometimes', 'always', 'never', 'already', 'yet', 'still', 'again'
  ]
  
  const words = text.toLowerCase().split(/\s+/)
  const totalWords = words.length
  
  if (totalWords < 3) return false
  
  // 计算常见单词的比例（降低阈值，更严格）
  const commonWordCount = words.filter(word => commonWords.includes(word)).length
  const commonWordRatio = commonWordCount / totalWords
  
  // 如果常见单词比例超过20%，且总单词数超过5个，可能是自然语言
  if (totalWords > 5 && commonWordRatio > 0.2) {
    return true
  }
  
  // 检查是否包含完整的句子结构
  const hasSentenceStructure = /^[A-Z][^.!?]*[.!?]\s*/.test(text) ||
                              /\b(Ask|Have|Then|Let|You|It|This|That|The|A|An|We|They|He|She|I)\b.*[.!?]/.test(text) ||
                              text.includes('. ') || text.includes('? ') || text.includes('! ')
  
  if (hasSentenceStructure && totalWords > 6) {
    return true
  }
  
  // 检查是否包含典型的自然语言模式
  const naturalLanguagePatterns = [
    /\b(you|your|we|our|they|their|he|his|she|her|i|my)\b/i,
    /\b(can|could|should|would|will|shall|may|might)\s+\w+/i,
    /\b(is|are|was|were|am|be|being|been)\s+\w+/i,
    /\b(have|has|had)\s+\w+/i,
    /\b(do|does|did)\s+\w+/i,
    /\b(there|here)\s+(is|are|was|were)/i,
    /\b(it|this|that)\s+(is|was|will|can|could)/i,
  ]
  
  const matchedPatterns = naturalLanguagePatterns.filter(pattern => pattern.test(text)).length
  if (matchedPatterns >= 2 && totalWords > 8) {
    return true
  }
  
  return false
}

// 检查文本是否看起来像代码 - 改进的检测逻辑
function isCodeLike(text: string): boolean {
  const trimmedText = text.trim()
  
  // 长度过短的文本不太可能是代码
  if (trimmedText.length < 3) {
    return false
  }
  
  // 检查是否明显是自然语言文本
  if (isNaturalLanguage(trimmedText)) {
    return false
  }
  
  // 检查是否是JSON格式
  if (trimmedText.startsWith('{') && trimmedText.endsWith('}')) {
    try {
      JSON.parse(trimmedText)
      return true
    } catch (e) {
      // 不是有效的JSON，继续检查其他特征
    }
  }
  
  // 检查强代码特征（这些特征出现就很可能是代码）
  const strongCodeFeatures = [
    // Python函数和类定义
    /def\s+\w+\s*\(/,
    /class\s+\w+\s*[\(:]/, 
    // Python导入语句
    /^(import|from)\s+\w+/,
    // Python控制流
    /^(if|for|while|try|with)\s+.*:/,
    // Python特殊方法
    /def\s+__\w+__\s*\(/,
    // 函数调用模式
    /\w+\s*\([^)]*\)\s*[:.]?/,
    // 赋值操作
    /\w+\s*=\s*\w+\s*\(/,
    // 字典或对象定义
    /{\s*["']\w+["']\s*:\s*/,
    // 列表推导式
    /\[.*for\s+\w+\s+in\s+.*\]/,
    // 装饰器
    /@\w+/,
    // Lambda表达式
    /lambda\s+.*:/,
    // 类型注解
    /:\s*(str|int|float|bool|List|Dict|Any|Optional)/,
    // JavaScript/TypeScript
    /(const|let|var)\s+\w+\s*=/,
    /function\s+\w+\s*\(/,
    /=>\s*{/,
    // Shell脚本
    /#!/,
    /^\$\s+/,
    // SQL语句
    /^(SELECT|INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)\s+/i,
    // 返回语句
    /^return\s+/,
    // 打印语句
    /print\s*\(/,
    // Python文档字符串
    /^\s*""".*"""$/s,
    /^\s*'''.*'''$/s,
    /^\s*"""/,
    /^\s*'''/,
    // 缩进的代码行（Python特征）
    /^\s{4,}\w+/,
    // 方法链调用
    /\w+\.\w+\.\w+/,
    // 包含多个括号的复杂表达式
    /\([^)]*\([^)]*\)[^)]*\)/,
  ]
  
  // 如果匹配任何强特征，直接认为是代码
  if (strongCodeFeatures.some(pattern => pattern.test(trimmedText))) {
    return true
  }
  
  // 检查一般代码特征（更严格的检测）
  const codeFeatures = [
    // Python关键字（更严格的匹配）
    text.includes('def ') || text.includes('class ') || text.includes('import ') || 
    text.includes('from ') || text.includes('return ') || text.includes('print(') ||
    text.includes('if __name__') || text.includes('async ') || text.includes('await ') ||
    text.includes('try:') || text.includes('except') || text.includes('with ') ||
    text.includes('lambda ') || text.includes('yield ') || text.includes('assert '),
    
    // JavaScript/TypeScript关键字
    text.includes('function ') || text.includes('const ') || text.includes('let ') || 
    text.includes('var ') || text.includes('export ') || text.includes('console.log') ||
    text.includes('typeof ') || text.includes('instanceof ') || text.includes('=>') ||
    text.includes('interface ') || text.includes('type ') || text.includes('enum '),
    
    // 更严格的编程结构（需要多个符号组合）
    (text.includes('(') && text.includes(')') && text.includes('{') && text.includes('}')),
    (text.includes('[') && text.includes(']') && text.includes(':') && text.includes('"')),
    
    // 特殊编程符号组合
    text.includes('::') || text.includes('->') || text.includes('=>'),
    text.includes('&&') || text.includes('||') || text.includes('==') || text.includes('!='),
    text.includes('+=') || text.includes('-=') || text.includes('*=') || text.includes('/='),
    
    // 明显的缩进代码（Python特征）
    /^\s{4,}\w+.*[=:]/.test(text),
    
    // 包含分号和赋值（JavaScript/C风格）
    text.includes(';') && text.includes('=') && !text.includes('. '),
    
    // 方法调用链（至少2个点）
    /\w+\.\w+\.\w+/.test(text),
    
    // 复杂的变量赋值模式
    /\w+\s*=\s*\w+\s*\(/.test(text),
    
    // 文档字符串（Python）
    (/^\s*"""/.test(text) && text.length > 10) || (/"""\s*$/.test(text) && text.length > 10),
    (/^\s*'''/.test(text) && text.length > 10) || (/'''\s*$/.test(text) && text.length > 10),
    
    // 明显的缩进代码块
    /^\s{4,}/.test(text) && text.length < 100 && (/[=(){}[\]]/.test(text)),
  ]
  
  // 计算匹配的特征数量
  const matchedFeatures = codeFeatures.filter(Boolean).length
  
  // 提高门槛：至少匹配2个特征才认为是代码
  return matchedFeatures >= 2
}

/**
 * 将 HTML 内容转换为 Markdown 格式
 * @param html HTML 内容
 * @returns Markdown 格式的内容
 */
export const htmlToMarkdown = (html: string): string => {
  if (!html) return ''
  
  try {
    // 清理 Omnivore 特有的属性
    let cleanedHtml = html
      .replace(/data-omnivore-[^=]*="[^"]*"/g, '') // 移除 data-omnivore-* 属性
      .replace(/data-src="[^"]*"/g, '') // 移除 data-src 属性
      .replace(/data-ratio="[^"]*"/g, '') // 移除 data-ratio 属性
      .replace(/data-s="[^"]*"/g, '') // 移除 data-s 属性
      .replace(/data-w="[^"]*"/g, '') // 移除 data-w 属性
      .replace(/data-original-style="[^"]*"/g, '') // 移除 data-original-style 属性
      .replace(/data-index="[^"]*"/g, '') // 移除 data-index 属性
      .replace(/data-report-img-idx="[^"]*"/g, '') // 移除 data-report-img-idx 属性
      .replace(/data-fail="[^"]*"/g, '') // 移除 data-fail 属性
      .replace(/data-trans_state="[^"]*"/g, '') // 移除 data-trans_state 属性
      .replace(/data-verify_state="[^"]*"/g, '') // 移除 data-verify_state 属性
      .replace(/data-pm-slice="[^"]*"/g, '') // 移除 data-pm-slice 属性
      .replace(/nodeleaf="[^"]*"/g, '') // 移除 nodeleaf 属性
      .replace(/leaf="[^"]*"/g, '') // 移除 leaf 属性
      .replace(/textstyle="[^"]*"/g, '') // 移除 textstyle 属性
      .replace(/data-selectable-paragraph="[^"]*"/g, '') // 移除 data-selectable-paragraph 属性
      .replace(/aria-label="[^"]*"/g, '') // 移除 aria-label 属性
      .replace(/role="[^"]*"/g, '') // 移除 role 属性
      .replace(/tabindex="[^"]*"/g, '') // 移除 tabindex 属性
      .replace(/loading="[^"]*"/g, '') // 移除 loading 属性
      .replace(/style="[^"]*"/g, '') // 移除 style 属性
      .replace(/id="[^"]*"/g, '') // 移除 id 属性
      .replace(/width="[^"]*"/g, '') // 移除 width 属性
      .replace(/height="[^"]*"/g, '') // 移除 height 属性
      .replace(/srcset="[^"]*"/g, '') // 移除 srcset 属性
      .replace(/sizes="[^"]*"/g, '') // 移除 sizes 属性
      .replace(/type="[^"]*"/g, '') // 移除 type 属性
      .replace(/rel="[^"]*"/g, '') // 移除 rel 属性
      .replace(/target="[^"]*"/g, '') // 移除 target 属性
      .replace(/data-testid="[^"]*"/g, '') // 移除 data-testid 属性
      .replace(/rel="[^"]*"/g, '') // 移除 rel 属性
      .replace(/target="[^"]*"/g, '') // 移除 target 属性
      .replace(/_width="[^"]*"/g, '') // 移除 _width 属性
      .replace(/alt=""/g, '') // 移除空的 alt 属性
      .replace(/role="presentation"/g, '') // 移除 presentation role
      .replace(/cursor: zoom-in;/g, '') // 移除 zoom-in 样式
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim()
    
    // 只处理<pre>标签中的代码，不再合并其他内容为代码块
    // cleanedHtml = mergeCodeBlocks(cleanedHtml) // 已禁用，只依赖<pre>标签识别代码
    
    // 使用 Turndown 转换为 Markdown
    const markdown = turndownService.turndown(cleanedHtml)
    
    // 进一步清理，但保留段落分隔
    let result = markdown
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 移除多余的空行，但保留双换行
      .trim()
    
    // 修复标题和段落的分隔问题
    // 确保标题后面有换行，但不要错误地合并标题和段落
    result = result
      .replace(/(#{1,6}\s+[^\n]+)\s+([A-Z][^#])/g, '$1\n\n$2')  // 标题后添加双换行
      .replace(/([.!?])\s+([A-Z][a-z]+(?:\s+[a-z]){2,})/g, '$1 $2')  // 只在确实是句子的情况下合并
    
    // 清理特定的文本，但保留换行
    result = result
      .replace(/Zoom image will be displayed/g, '') // 移除 "Zoom image will be displayed"
      .replace(/Source:/g, '**Source:**') // 格式化 Source 标签
      .replace(/Created by Author/g, '**Created by Author**') // 格式化作者标签
      .replace(/\[Source:/g, '**Source:**') // 格式化 Source 标签
      .replace(/\[Image by author\]/g, '**Image by author**') // 格式化图片作者标签
      .replace(/\*\*\*\*/g, '**') // 修复多余的星号
      .replace(/\*\*\*\*/g, '**') // 再次修复多余的星号
      .trim()
    
    // 最后确保段落之间有适当的空行，但不破坏段落分隔
    result = result
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 移除多余的空行
      .trim()
    
    return result
  } catch (error) {
    console.error('HTML to Markdown conversion failed:', error)
    return html // 如果转换失败，返回原始 HTML
  }
}
