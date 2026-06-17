import { DevToolsClient } from '../DevToolsClient'
import { generateUuid } from '../utils/uuid'
import { safeSerialize } from '../utils/serializer'
import { HttpMethod } from '../types'

let originalXhrOpen: any = null
let originalXhrSend: any = null
let originalXhrSetRequestHeader: any = null

interface InterceptedXHR extends XMLHttpRequest {
  __devinspector_id?: string
  __devinspector_method?: string
  __devinspector_url?: string
  __devinspector_startTime?: number
  __devinspector_requestHeaders?: Record<string, string>
}

export function installXhrInterceptor(client: DevToolsClient) {
  if (originalXhrOpen) return

  originalXhrOpen = XMLHttpRequest.prototype.open
  originalXhrSend = XMLHttpRequest.prototype.send
  originalXhrSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader

  XMLHttpRequest.prototype.open = function(
    method: string, 
    url: string | URL, 
    async?: boolean, 
    username?: string | null, 
    password?: string | null
  ) {
    const xhr = this as InterceptedXHR
    xhr.__devinspector_id = generateUuid()
    xhr.__devinspector_method = method.toUpperCase()
    xhr.__devinspector_url = url.toString()
    xhr.__devinspector_requestHeaders = {}

    return originalXhrOpen.call(this, method, url, async !== false, username, password)
  }

  XMLHttpRequest.prototype.setRequestHeader = function(header: string, value: string) {
    const xhr = this as InterceptedXHR
    if (xhr.__devinspector_requestHeaders) {
      xhr.__devinspector_requestHeaders[header] = value
    }
    return originalXhrSetRequestHeader.call(this, header, value)
  }

  XMLHttpRequest.prototype.send = function(data?: Document | XMLHttpRequestBodyInit | null) {
    const xhr = this as InterceptedXHR
    
    if (xhr.__devinspector_id) {
      xhr.__devinspector_startTime = Date.now()
      
      let parsedBody: unknown = data
      if (typeof data === 'string') {
        try { parsedBody = JSON.parse(data) } catch {}
      }

      client.send({
        type: 'network:request-start',
        payload: {
          id: xhr.__devinspector_id,
          url: xhr.__devinspector_url || '',
          method: (xhr.__devinspector_method || 'GET') as HttpMethod,
          requestHeaders: xhr.__devinspector_requestHeaders || {},
          requestBody: parsedBody !== undefined ? safeSerialize(parsedBody).value : undefined,
          startTime: xhr.__devinspector_startTime,
          source: 'xhr'
        }
      })

      const handleLoadEnd = () => {
        if (!xhr.__devinspector_id || !xhr.__devinspector_startTime) return
        
        const endTime = Date.now()
        const duration = endTime - xhr.__devinspector_startTime

        if (xhr.status === 0) {
          // It's likely an error/abort that didn't trigger onerror
          return
        }

        const headersString = xhr.getAllResponseHeaders()
        const responseHeaders: Record<string, string> = {}
        if (headersString) {
          headersString.trim().split(/[\r\n]+/).forEach((line) => {
            const parts = line.split(': ')
            const header = parts.shift()
            const value = parts.join(': ')
            if (header) responseHeaders[header] = value
          })
        }

        let responseBody: unknown = xhr.response
        let responseSize: number | null = null

        if (typeof xhr.response === 'string') {
          responseSize = xhr.response.length
          try {
            responseBody = JSON.parse(xhr.response)
          } catch {}
        } else if (xhr.responseType === '' || xhr.responseType === 'text') {
          try {
            if (xhr.responseText) {
              responseSize = xhr.responseText.length
              try {
                responseBody = JSON.parse(xhr.responseText)
              } catch {
                responseBody = xhr.responseText
              }
            }
          } catch (e) {
            // Ignore access errors
          }
        }

        client.send({
          type: 'network:request-end',
          payload: {
            id: xhr.__devinspector_id,
            statusCode: xhr.status,
            responseHeaders,
            responseBody,
            responseSize,
            endTime,
            duration
          }
        })
      }

      const handleError = (e: ProgressEvent) => {
        if (!xhr.__devinspector_id || !xhr.__devinspector_startTime) return
        const endTime = Date.now()
        client.send({
          type: 'network:request-error',
          payload: {
            id: xhr.__devinspector_id,
            error: 'XHR Error / Network failed',
            endTime,
            duration: endTime - xhr.__devinspector_startTime
          }
        })
      }

      xhr.addEventListener('load', handleLoadEnd)
      xhr.addEventListener('error', handleError)
      xhr.addEventListener('abort', handleError)
      xhr.addEventListener('timeout', handleError)
    }

    return originalXhrSend.call(this, data)
  }
}

export function uninstallXhrInterceptor() {
  if (originalXhrOpen) {
    XMLHttpRequest.prototype.open = originalXhrOpen
    XMLHttpRequest.prototype.send = originalXhrSend
    XMLHttpRequest.prototype.setRequestHeader = originalXhrSetRequestHeader
    
    originalXhrOpen = null
    originalXhrSend = null
    originalXhrSetRequestHeader = null
  }
}
