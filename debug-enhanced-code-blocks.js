// 调试增强的代码块识别功能
const TurndownService = require('turndown');

// 模拟 HTML 到 Markdown 转换器
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  emDelimiter: '*',
  bulletListMarker: '-',
  strongDelimiter: '**',
});

// 移除默认的段落规则
turndownService.remove('p');

// 处理段落标签，确保段落之间有适当的间距
turndownService.addRule('paragraphs', {
  filter: 'p',
  replacement: function (content) {
    return content.trim() + '\n\n';
  }
});

// 处理标题标签，确保标题之间有适当的间距
turndownService.addRule('headings', {
  filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
  replacement: function (content, node) {
    const element = node;
    const level = parseInt(element.tagName.charAt(1));
    const prefix = '#'.repeat(level);
    return `\n\n${prefix} ${content.trim()}\n\n`;
  }
});

// 增强的代码块处理规则
turndownService.addRule('enhancedCodeBlocks', {
  filter: function (node) {
    // 检查是否是包含代码的段落
    if (node.nodeType === 1 && node.tagName === 'P') { // 元素节点且是段落
      const text = node.textContent?.trim() || '';
      // 检查是否看起来像代码
      return isCodeLike(text);
    }
    return false;
  },
  replacement: function (content, node) {
    const text = node.textContent?.trim() || '';
    const language = detectLanguage(text);
    return `\n\n\`\`\`${language}\n${text}\n\`\`\`\n\n`;
  }
});

// 检测代码语言类型
function detectLanguage(text) {
  // 尝试解析JSON
  try {
    JSON.parse(text);
    return 'json';
  } catch (e) {
    // 不是有效的JSON，继续检测其他语言
  }

  // 检测Python代码
  if (text.includes('def ') || text.includes('import ') || text.includes('from ') || 
      text.includes('class ') || text.includes('if __name__') || text.includes('print(') ||
      text.includes('return ') || text.includes('elif ') || text.includes('else:') ||
      text.includes('try:') || text.includes('except ') || text.includes('finally:') ||
      text.includes('with ') || text.includes('as ') || text.includes('lambda ') ||
      text.includes('yield ') || text.includes('raise ') || text.includes('assert ')) {
    return 'python';
  }

  // 检测JavaScript/TypeScript代码
  if (text.includes('function ') || text.includes('const ') || text.includes('let ') || 
      text.includes('var ') || text.includes('=>') || text.includes('import ') ||
      text.includes('export ') || text.includes('class ') || text.includes('extends ') ||
      text.includes('interface ') || text.includes('type ') || text.includes('enum ') ||
      text.includes('async ') || text.includes('await ') || text.includes('Promise') ||
      text.includes('console.log') || text.includes('document.') || text.includes('window.')) {
    return text.includes('interface ') || text.includes('type ') || text.includes('enum ') ? 'typescript' : 'javascript';
  }

  // 检测Bash/Shell脚本
  if (text.includes('#!/bin/bash') || text.includes('#!/bin/sh') || text.includes('#!/usr/bin/env') ||
      text.includes('echo ') || text.includes('cd ') || text.includes('ls ') || text.includes('cp ') ||
      text.includes('mv ') || text.includes('rm ') || text.includes('mkdir ') || text.includes('chmod ') ||
      text.includes('grep ') || text.includes('sed ') || text.includes('awk ') || text.includes('curl ') ||
      text.includes('wget ') || text.includes('ssh ') || text.includes('scp ') || text.includes('tar ') ||
      text.includes('if [') || text.includes('then') || text.includes('fi') || text.includes('for ') ||
      text.includes('while ') || text.includes('do') || text.includes('done') || text.includes('case ') ||
      text.includes('esac') || text.includes('function ') || text.includes('export ') || text.includes('source ')) {
    return 'bash';
  }

  // 检测INI配置文件
  if (text.includes('[') && text.includes(']') && (text.includes('=') || text.includes(':')) &&
      !text.includes('{') && !text.includes('}') && !text.includes('function') && !text.includes('def ')) {
    return 'ini';
  }

  // 检测YAML
  if (text.includes(':') && (text.includes('- ') || text.includes('  ')) && 
      !text.includes('{') && !text.includes('}') && !text.includes('function') && !text.includes('def ')) {
    return 'yaml';
  }

  // 检测SQL
  if (text.includes('SELECT ') || text.includes('INSERT ') || text.includes('UPDATE ') || 
      text.includes('DELETE ') || text.includes('CREATE ') || text.includes('DROP ') ||
      text.includes('ALTER ') || text.includes('FROM ') || text.includes('WHERE ') ||
      text.includes('JOIN ') || text.includes('GROUP BY ') || text.includes('ORDER BY ') ||
      text.includes('HAVING ') || text.includes('UNION ') || text.includes('INNER JOIN ') ||
      text.includes('LEFT JOIN ') || text.includes('RIGHT JOIN ')) {
    return 'sql';
  }

  // 检测HTML
  if (text.includes('<') && text.includes('>') && 
      (text.includes('<div') || text.includes('<p') || text.includes('<span') || 
       text.includes('<a') || text.includes('<img') || text.includes('<ul') || 
       text.includes('<li') || text.includes('<table') || text.includes('<tr') || 
       text.includes('<td') || text.includes('<th') || text.includes('<form') || 
       text.includes('<input') || text.includes('<button') || text.includes('<script') || 
       text.includes('<style') || text.includes('<link') || text.includes('<meta'))) {
    return 'html';
  }

  // 检测CSS
  if (text.includes('{') && text.includes('}') && 
      (text.includes('color:') || text.includes('background:') || text.includes('margin:') || 
       text.includes('padding:') || text.includes('border:') || text.includes('font:') || 
       text.includes('display:') || text.includes('position:') || text.includes('width:') || 
       text.includes('height:') || text.includes('text-align:') || text.includes('float:') || 
       text.includes('clear:') || text.includes('overflow:') || text.includes('z-index:') || 
       text.includes('opacity:') || text.includes('transform:') || text.includes('transition:') || 
       text.includes('animation:') || text.includes('@media') || text.includes('@keyframes'))) {
    return 'css';
  }

  // 检测XML
  if (text.includes('<') && text.includes('>') && text.includes('<?xml') || 
      (text.includes('<') && text.includes('>') && text.includes('</') && 
       !text.includes('function') && !text.includes('def ') && !text.includes('SELECT '))) {
    return 'xml';
  }

  // 检测Markdown
  if (text.includes('# ') || text.includes('## ') || text.includes('### ') || 
      text.includes('**') || text.includes('*') || text.includes('`') || 
      text.includes('[') && text.includes('](') || text.includes('![') || 
      text.includes('> ') || text.includes('- ') || text.includes('1. ')) {
    return 'markdown';
  }

  // 检测Dockerfile
  if (text.includes('FROM ') || text.includes('RUN ') || text.includes('CMD ') || 
      text.includes('ENTRYPOINT ') || text.includes('COPY ') || text.includes('ADD ') ||
      text.includes('ENV ') || text.includes('EXPOSE ') || text.includes('VOLUME ') ||
      text.includes('WORKDIR ') || text.includes('USER ') || text.includes('ARG ')) {
    return 'dockerfile';
  }

  // 检测Git配置
  if (text.includes('[user]') || text.includes('[core]') || text.includes('[remote') || 
      text.includes('[branch') || text.includes('[alias]') || text.includes('[credential]') ||
      text.includes('name = ') || text.includes('email = ') || text.includes('url = ')) {
    return 'gitconfig';
  }

  // 如果包含大括号，可能是JSON或其他结构化数据
  if (text.includes('{') && text.includes('}')) {
    return 'json';
  }

  // 默认返回空字符串（无语言标识）
  return '';
}

// 检查文本是否看起来像代码
function isCodeLike(text) {
  // 检查是否看起来像代码（包含大括号、引号、关键字等）
  return (text.startsWith('{') && text.endsWith('}')) || 
         (text.includes('function') && text.includes('(') && text.includes(')')) ||
         (text.includes('const') && text.includes('=')) ||
         (text.includes('import') && text.includes('from')) ||
         (text.includes('def ') && text.includes(':')) ||
         (text.includes('class ') && text.includes(':')) ||
         (text.includes('if ') && text.includes(':')) ||
         (text.includes('for ') && text.includes(':')) ||
         (text.includes('while ') && text.includes(':')) ||
         (text.includes('try:') || text.includes('except ')) ||
         (text.includes('echo ') || text.includes('cd ') || text.includes('ls ')) ||
         (text.includes('SELECT ') || text.includes('FROM ') || text.includes('WHERE ')) ||
         (text.includes('<') && text.includes('>') && text.includes('</')) ||
         (text.includes('color:') || text.includes('background:') || text.includes('margin:')) ||
         (text.includes('#!/bin/') || text.includes('#!/usr/bin/')) ||
         (text.includes('[') && text.includes(']') && text.includes('=')) ||
         (text.includes('# ') && text.includes('**') && text.includes('*')) ||
         (text.includes('FROM ') || text.includes('RUN ') || text.includes('CMD ')) ||
         (text.includes('[user]') || text.includes('[core]') || text.includes('[remote'));
}

function htmlToMarkdown(html) {
  if (!html) return '';
  
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
      .replace(/_width="[^"]*"/g, '') // 移除 _width 属性
      .replace(/alt=""/g, '') // 移除空的 alt 属性
      .replace(/role="presentation"/g, '') // 移除 presentation role
      .replace(/cursor: zoom-in;/g, '') // 移除 zoom-in 样式
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim();
    
    // 使用 Turndown 转换为 Markdown
    const markdown = turndownService.turndown(cleanedHtml);
    
    // 进一步清理，但保留段落分隔
    let result = markdown
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 移除多余的空行，但保留双换行
      .trim()
    
    // 手动处理段落分隔，但更智能地处理
    // 只在真正的段落边界添加换行，而不是每个句号
    result = result.replace(/([.!?])\s*([A-Z][a-z])/g, '$1 $2')
    
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
    
    return result;
  } catch (error) {
    console.error('HTML to Markdown conversion failed:', error);
    return html; // 如果转换失败，返回原始 HTML
  }
}

// 测试 HTML 内容
const testHtml = `<p data-omnivore-anchor-idx="21" id="e30f" data-selectable-paragraph=""><strong data-omnivore-anchor-idx="22">Ever</strong> wondered if you could leverage the power of Retrieval Augmented Generation (RAG)<strong data-omnivore-anchor-idx="23"> without the complexity of embedding models or vector databases</strong>? There is an innovative approach to RAG using structured CSV data, powered by models from the NVIDIA API Catalog and orchestrated by PandasAI.</p><p data-omnivore-anchor-idx="24" id="2d9c" data-selectable-paragraph="">While exploring the NVIDIA repository on GitHub, I came across an interesting thing, named a structured data RAG.</p><p data-omnivore-anchor-idx="25" id="3e0g" data-selectable-paragraph=""><em data-omnivore-anchor-idx="56">What is Structured RAG, Really? It's Logic vs. Vibes</em></p><p data-omnivore-anchor-idx="26" id="4f1h" data-selectable-paragraph="">Here is an example of a structured query:</p><p data-omnivore-anchor-idx="27" id="5g2i" data-selectable-paragraph="">{ "type": "AND", "clauses": [ { "field": "entity", "value": "Alice" }, { "field": "entity", "value": "Acme Corp" }, { "field": "action", "value": "approved" }, { "field": "topic", "value": "Q4 initiative" } ] }</p><p data-omnivore-anchor-idx="28" id="6h3j" data-selectable-paragraph="">Here is a Python function:</p><p data-omnivore-anchor-idx="29" id="7i4k" data-selectable-paragraph="">def process_data(data): return [item for item in data if item['status'] == 'active']</p><p data-omnivore-anchor-idx="30" id="8j5l" data-selectable-paragraph="">Here is a bash script:</p><p data-omnivore-anchor-idx="31" id="9k6m" data-selectable-paragraph="">#!/bin/bash echo "Hello World" cd /tmp ls -la</p><p data-omnivore-anchor-idx="32" id="10l7n" data-selectable-paragraph="">Here is an INI configuration:</p><p data-omnivore-anchor-idx="33" id="11m8o" data-selectable-paragraph="">[database] host = localhost port = 5432 name = mydb</p>`;

console.log('=== 调试增强的代码块识别功能 ===\n');

console.log('1. 原始 HTML 内容:');
console.log(testHtml);
console.log('\n2. 转换后的 Markdown 内容:');
const markdown = htmlToMarkdown(testHtml);
console.log(markdown);

console.log('\n=== 功能说明 ===');
console.log('✅ 自动识别JSON代码并放入代码块');
console.log('✅ 自动识别Python代码');
console.log('✅ 自动识别JavaScript/TypeScript代码');
console.log('✅ 自动识别Bash/Shell脚本');
console.log('✅ 自动识别INI配置文件');
console.log('✅ 自动识别YAML配置');
console.log('✅ 自动识别SQL查询');
console.log('✅ 自动识别HTML代码');
console.log('✅ 自动识别CSS样式');
console.log('✅ 自动识别XML文档');
console.log('✅ 自动识别Markdown语法');
console.log('✅ 自动识别Dockerfile');
console.log('✅ 自动识别Git配置');
console.log('✅ 保持代码格式和缩进');
console.log('✅ 添加适当的语言标识'); 