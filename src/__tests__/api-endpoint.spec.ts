import { baseUrl } from '../api'

describe('API Endpoint Configuration', () => {
  describe('baseUrl function', () => {
    it('should extract base URL from GraphQL endpoint', () => {
      const endpoint = 'https://api-prod.omnivore.historyai.top/api/graphql'
      const result = baseUrl(endpoint)
      expect(result).toBe('https://api-prod.omnivore.historyai.top')
    })

    it('should handle custom self-hosted endpoints', () => {
      const endpoint = 'https://my-omnivore-server.com/api/graphql'
      const result = baseUrl(endpoint)
      expect(result).toBe('https://my-omnivore-server.com')
    })

    it('should handle endpoints without /api/graphql suffix', () => {
      const endpoint = 'https://custom-server.com'
      const result = baseUrl(endpoint)
      expect(result).toBe('https://custom-server.com')
    })

    it('should handle HTTP endpoints', () => {
      const endpoint = 'http://localhost:8080/api/graphql'
      const result = baseUrl(endpoint)
      expect(result).toBe('http://localhost:8080')
    })

    it('should throw error for empty endpoint', () => {
      expect(() => baseUrl('')).toThrow('API endpoint is not configured')
    })

    it('should throw error for undefined endpoint', () => {
      expect(() => baseUrl(undefined as unknown as string)).toThrow(
        'API endpoint is not configured',
      )
    })
  })
})
