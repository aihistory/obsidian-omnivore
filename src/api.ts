import { Item, ItemFormat, Omnivore } from '@omnivore-app/api'
import { requestUrl } from 'obsidian'

export enum HighlightColors {
  Yellow = 'yellow',
  Red = 'red',
  Green = 'green',
  Blue = 'blue',
}

interface GetContentResponse {
  data: {
    libraryItemId: string
    downloadUrl: string
    error?: string
  }[]
}

export const baseUrl = (endpoint: string) => {
  if (!endpoint) {
    throw new Error(
      'API endpoint is not configured. Please set the API endpoint in settings.',
    )
  }
  return endpoint.replace(/\/api\/graphql$/, '')
}

const getContent = async (
  endpoint: string,
  apiKey: string,
  libraryItemIds: string[],
  format: ItemFormat = 'highlightedMarkdown',
): Promise<GetContentResponse> => {
  const response = await requestUrl({
    url: `${baseUrl(endpoint)}/api/content`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({ libraryItemIds, format }),
  })

  return response.json
}

const downloadFromUrl = async (url: string): Promise<string> => {
  try {
    // polling until download is ready or failed
    const response = await requestUrl({
      url,
    })
    return response.text
  } catch (error) {
    // retry after 1 second if download returns 404
    if (error.status === 404) {
      await sleep(1000)
      return downloadFromUrl(url)
    }

    throw error
  }
}

const fetchContentForItems = async (
  endpoint: string,
  apiKey: string,
  items: Item[],
  format: ItemFormat = 'highlightedMarkdown',
) => {
  const content = await getContent(
    endpoint,
    apiKey,
    items.map((a) => a.id),
    format,
  )

  await Promise.allSettled(
    content.data.map(async (c) => {
      if (c.error) {
        console.error('Error fetching content', c.error)
        return
      }

      const item = items.find((i) => i.id === c.libraryItemId)
      if (!item) {
        console.error('Item not found', c.libraryItemId)
        return
      }

      // timeout if download takes too long
      item.content = await Promise.race([
        downloadFromUrl(c.downloadUrl),
        new Promise<string>(
          (_, reject) => setTimeout(() => reject('Timeout'), 600_000), // 10 minutes
        ),
      ])
    }),
  )
}

export const getItems = async (
  endpoint: string,
  apiKey: string,
  after = 0,
  first = 10,
  updatedAt = '',
  query = '',
  includeContent = false,
  format: ItemFormat = 'html',
): Promise<[Item[], boolean]> => {
  try {
    const omnivore = new Omnivore({
      authToken: apiKey,
      baseUrl: baseUrl(endpoint),
      timeoutMs: 10000, // 10 seconds
    })

    const response = await omnivore.items.search({
      after,
      first,
      query: `${updatedAt ? 'updated:' + updatedAt : ''} sort:saved-asc ${query}`,
      includeContent,
      format,
    })

    const items = response.edges.map((e) => e.node)
    if (includeContent && items.length > 0) {
      try {
        await fetchContentForItems(endpoint, apiKey, items, format)
      } catch (error) {
        console.error('Error fetching content', error)
      }
    }

    return [items, response.pageInfo.hasNextPage]
  } catch (error) {
    console.error('Error in getItems:', error)
    
    // 提供更详细的错误信息
    if (error.message?.includes('Unexpected server error')) {
      throw new Error(
        `服务器错误 (500): 请检查您的API密钥是否正确，或者服务器是否正常运行。\n端点: ${endpoint}\n错误详情: ${error.message}`
      )
    } else if (error.message?.includes('Unauthorized')) {
      throw new Error(
        `认证失败: 请检查您的API密钥是否正确。\n端点: ${endpoint}`
      )
    } else if (error.message?.includes('Network error')) {
      throw new Error(
        `网络错误: 无法连接到服务器。\n端点: ${endpoint}\n请检查网络连接和端点URL是否正确。`
      )
    } else {
      throw new Error(
        `API请求失败: ${error.message}\n端点: ${endpoint}`
      )
    }
  }
}

export const deleteItem = async (
  endpoint: string,
  apiKey: string,
  articleId: string,
) => {
  const omnivore = new Omnivore({
    authToken: apiKey,
    baseUrl: baseUrl(endpoint),
    timeoutMs: 10000, // 10 seconds
  })

  await omnivore.items.delete({ id: articleId })

  return true
}
