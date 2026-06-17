import { DevToolsClient } from '../DevToolsClient'
import { generateUuid } from '../utils/uuid'
import { safeSerialize } from '../utils/serializer'
import { HttpMethod } from '../types'

let originalFetch: typeof fetch | null = null

export function installFetchInterceptor(client: DevToolsClient) {
  if (originalFetch) return // Already installed
  
  originalFetch = global.fetch

  global.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const id = generateUuid()
    const startTime = Date.now()
    
    // Parse request info
    let url = ''
    let method = 'GET'
    let headers: Record<string, string> = {}
    let body: unknown = undefined

    if (typeof input === 'string') {
      url = input
    } else if (input instanceof URL) {
      url = input.toString()
    } else if (input && typeof input === 'object') {
      url = input.url
      method = input.method || 'GET'
      
      if (input.headers) {
        if (input.headers instanceof Headers) {
          input.headers.forEach((val, key) => { headers[key] = val })
        } else {
          headers = input.headers as Record<string, string>
        }
      }
    }

    if (init) {
      if (init.method) method = init.method
      if (init.body) {
        try {
          if (typeof init.body === 'string') {
            body = JSON.parse(init.body)
          } else {
            body = init.body
          }
        } catch {
          body = init.body
        }
      }
      if (init.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((val, key) => { headers[key] = val })
        } else if (Array.isArray(init.headers)) {
          init.headers.forEach(([key, val]) => { headers[key] = val })
        } else {
          headers = { ...headers, ...(init.headers as Record<string, string>) }
        }
      }
    }

    // Send start event
    client.send({
      type: 'network:request-start',
      payload: {
        id,
        url,
        method: method.toUpperCase() as HttpMethod,
        requestHeaders: headers,
        requestBody: body !== undefined ? safeSerialize(body).value : undefined,
        startTime,
        source: 'fetch'
      }
    })

    try {
      if (!originalFetch) throw new Error('Fetch interceptor error')
      const response = await originalFetch(input, init)
      const endTime = Date.now()
      const duration = endTime - startTime

      // Clone response to read body without consuming it
      const responseClone = response.clone()
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((val, key) => { responseHeaders[key] = val })
      
      let responseBody: unknown = null
      let responseSize: number | null = null

      try {
        const text = await responseClone.text()
        responseSize = text.length
        try {
          responseBody = JSON.parse(text)
        } catch {
          responseBody = text
        }
      } catch (e) {
        responseBody = '[Could not read body]'
      }

      client.send({
        type: 'network:request-end',
        payload: {
          id,
          statusCode: response.status,
          responseHeaders,
          responseBody,
          responseSize,
          endTime,
          duration
        }
      })

      return response
    } catch (error: any) {
      const endTime = Date.now()
      client.send({
        type: 'network:request-error',
        payload: {
          id,
          error: error.message || String(error),
          endTime,
          duration: endTime - startTime
        }
      })
      throw error
    }
  }
}

export function uninstallFetchInterceptor() {
  if (originalFetch) {
    global.fetch = originalFetch
    originalFetch = null
  }
}
