import type { NetworkRequest } from '../types/network'

/**
 * Converte as requisições capturadas para HAR 1.2 — o formato que Chrome DevTools,
 * Insomnia, Postman e Charles leem nativamente.
 *
 * Especificação: http://www.softwareishard.com/blog/har-12-spec/
 */

interface HarNameValue {
  name: string
  value: string
}

function toNameValueList(headers: Record<string, string> | undefined): HarNameValue[] {
  if (!headers) return []
  return Object.entries(headers).map(([name, value]) => ({ name, value: String(value ?? '') }))
}

function bodyToString(body: unknown): string {
  if (body === null || body === undefined) return ''
  if (typeof body === 'string') return body
  try {
    return JSON.stringify(body)
  } catch {
    return String(body)
  }
}

function guessMimeType(headers: Record<string, string> | undefined, fallback = 'application/json'): string {
  if (!headers) return fallback
  const key = Object.keys(headers).find((h) => h.toLowerCase() === 'content-type')
  return key ? headers[key] : fallback
}

function splitQueryString(url: string): HarNameValue[] {
  const queryIndex = url.indexOf('?')
  if (queryIndex === -1) return []

  return url
    .slice(queryIndex + 1)
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=')
      const rawName = eq === -1 ? pair : pair.slice(0, eq)
      const rawValue = eq === -1 ? '' : pair.slice(eq + 1)
      try {
        return { name: decodeURIComponent(rawName), value: decodeURIComponent(rawValue) }
      } catch {
        return { name: rawName, value: rawValue }
      }
    })
}

function toHarEntry(request: NetworkRequest) {
  const requestBody = bodyToString(request.requestBody)
  const responseBody = bodyToString(request.responseBody)
  const duration = request.duration ?? 0

  return {
    startedDateTime: new Date(request.startTime).toISOString(),
    time: duration,
    request: {
      method: request.method,
      url: request.url,
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: toNameValueList(request.requestHeaders),
      queryString: splitQueryString(request.url),
      headersSize: -1,
      bodySize: requestBody.length,
      ...(requestBody
        ? {
            postData: {
              mimeType: guessMimeType(request.requestHeaders),
              text: requestBody
            }
          }
        : {})
    },
    response: {
      // HAR usa status 0 para requisições que falharam antes de obter resposta
      status: request.statusCode ?? 0,
      statusText: request.error ?? '',
      httpVersion: 'HTTP/1.1',
      cookies: [],
      headers: toNameValueList(request.responseHeaders),
      content: {
        size: request.responseSize ?? responseBody.length,
        mimeType: guessMimeType(request.responseHeaders, 'text/plain'),
        text: responseBody
      },
      redirectURL: '',
      headersSize: -1,
      bodySize: request.responseSize ?? responseBody.length
    },
    cache: {},
    timings: {
      // Só medimos o tempo total: o SDK não instrumenta as fases de DNS/conexão.
      blocked: -1,
      dns: -1,
      connect: -1,
      send: 0,
      wait: duration,
      receive: 0,
      ssl: -1
    },
    _devinspector: {
      id: request.id,
      source: request.source,
      status: request.status,
      error: request.error
    }
  }
}

export function buildHar(requests: NetworkRequest[], appVersion: string): string {
  const har = {
    log: {
      version: '1.2',
      creator: {
        name: 'DevInspector',
        version: appVersion
      },
      pages: [],
      entries: requests
        .slice()
        .sort((a, b) => a.startTime - b.startTime)
        .map(toHarEntry)
    }
  }

  return JSON.stringify(har, null, 2)
}
