import type { NetworkRequest } from '../types/network'

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms === undefined) return '—'
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(2)} s`
  return `${(ms / 60000).toFixed(1)} min`
}

export function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  const ms = d.getMilliseconds().toString().padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}

export function truncateUrl(url: string, maxLen: number = 80): string {
  try {
    const u = new URL(url)
    const path = u.pathname + u.search
    if (path.length <= maxLen) return path
    return path.substring(0, maxLen - 3) + '...'
  } catch {
    if (url.length <= maxLen) return url
    return url.substring(0, maxLen - 3) + '...'
  }
}

export function truncateString(str: string, maxLen: number = 500): string {
  if (str.length <= maxLen) return str
  return str.substring(0, maxLen) + `... (${str.length} chars)`
}

export function getStatusColor(status: number | null): string {
  if (status === null) return 'var(--color-text-muted)'
  if (status >= 200 && status < 300) return 'var(--color-success)'
  if (status >= 300 && status < 400) return 'var(--color-warning)'
  if (status >= 400 && status < 500) return 'var(--color-error)'
  if (status >= 500) return 'var(--color-error-bright)'
  return 'var(--color-text-muted)'
}

export function getMethodColor(method: string): string {
  const colors: Record<string, string> = {
    GET: '#61affe',
    POST: '#49cc90',
    PUT: '#fca130',
    DELETE: '#f93e3e',
    PATCH: '#50e3c2',
    HEAD: '#9012fe',
    OPTIONS: '#0d5aa7'
  }
  return colors[method.toUpperCase()] || '#999'
}

export function getLogLevelColor(level: string): string {
  const colors: Record<string, string> = {
    log: '#d4d4d4',
    info: '#3794ff',
    warn: '#cca700',
    error: '#f44747',
    table: '#4ec9b0'
  }
  return colors[level] || '#d4d4d4'
}

export function getLogLevelBg(level: string): string {
  const colors: Record<string, string> = {
    log: 'transparent',
    info: 'rgba(55, 148, 255, 0.06)',
    warn: 'rgba(204, 167, 0, 0.08)',
    error: 'rgba(244, 71, 71, 0.08)',
    table: 'rgba(78, 201, 176, 0.06)'
  }
  return colors[level] || 'transparent'
}

export function safeStringify(value: unknown, indent: number = 2): string {
  const seen = new WeakSet()
  return JSON.stringify(value, (_key, val) => {
    if (typeof val === 'object' && val !== null) {
      if (seen.has(val)) return '[Circular]'
      seen.add(val)
    }
    if (typeof val === 'bigint') return val.toString() + 'n'
    if (typeof val === 'function') return `[Function: ${val.name || 'anonymous'}]`
    if (typeof val === 'symbol') return val.toString()
    if (val === undefined) return '[undefined]'
    return val
  }, indent)
}

export function generateCurlCommand(request: NetworkRequest): string {
  let curl = `curl -X ${request.method} "${request.url}"`
  
  if (request.requestHeaders) {
    for (const [key, value] of Object.entries(request.requestHeaders)) {
      curl += ` \\\n  -H "${key}: ${value.replace(/"/g, '\\"')}"`
    }
  }

  if (request.requestBody) {
    let bodyData = ''
    if (typeof request.requestBody === 'string') {
      bodyData = request.requestBody
    } else {
      try { bodyData = JSON.stringify(request.requestBody) } catch {}
    }
    if (bodyData) {
      const escapedBody = bodyData.replace(/'/g, "'\\''")
      curl += ` \\\n  -d '${escapedBody}'`
    }
  }

  return curl
}
