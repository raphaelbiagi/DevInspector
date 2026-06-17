import type { HttpRequestPayload, HttpResponsePayload } from './protocol'

export interface RequestDiff {
  requestId: string
  previousRequestId: string
  bodyDiff: DiffLine[]
  headersDiff: DiffLine[]
  statusChanged: boolean
  previousStatus?: number
  durationDelta?: number  // ms — positivo = ficou mais lento
}

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  key?: string
  value: string
  line: number
}

type StoredEntry = {
  request: HttpRequestPayload
  response: HttpResponsePayload
}

export class RequestDiffer {
  // Chave: método + URL normalizada -> última entry
  private history = new Map<string, StoredEntry>()

  record(request: HttpRequestPayload, response: HttpResponsePayload): RequestDiff | null {
    const key = this.buildKey(request)
    const previous = this.history.get(key)

    this.history.set(key, { request, response })

    if (!previous) return null

    return {
      requestId: request.id,
      previousRequestId: previous.request.id,
      bodyDiff: this.diffJson(previous.response.body, response.body),
      headersDiff: this.diffHeaders(previous.response.headers, response.headers),
      statusChanged: previous.response.statusCode !== response.statusCode,
      previousStatus: previous.response.statusCode,
      durationDelta: response.duration - previous.response.duration,
    }
  }

  private buildKey(request: HttpRequestPayload): string {
    // Normaliza URLs removendo query strings e IDs numéricos
    const url = request.url
      .replace(/\?.*$/, '')
      .replace(/\/\d+/g, '/:id')
    return `${request.method}:${url}`
  }

  private diffJson(
    previous: string | undefined,
    current: string | undefined
  ): DiffLine[] {
    if (!previous && !current) return []
    if (!previous) return [{ type: 'added', value: current ?? '', line: 0 }]
    if (!current)  return [{ type: 'removed', value: previous, line: 0 }]

    try {
      const prevObj = JSON.parse(previous)
      const currObj = JSON.parse(current)
      return this.diffObjects(prevObj, currObj)
    } catch {
      return this.diffText(previous, current)
    }
  }

  private diffObjects(
    prev: Record<string, unknown>,
    curr: Record<string, unknown>,
    prefix = ''
  ): DiffLine[] {
    const lines: DiffLine[] = []
    const allKeys = Array.from(new Set(Object.keys(prev).concat(Object.keys(curr))))
    let lineNum = 0

    for (const key of allKeys) {
      const fullKey = prefix ? `${prefix}.${key}` : key
      const prevVal = JSON.stringify(prev[key])
      const currVal = JSON.stringify(curr[key])

      if (!(key in prev)) {
        lines.push({ type: 'added',   key: fullKey, value: currVal, line: lineNum++ })
      } else if (!(key in curr)) {
        lines.push({ type: 'removed', key: fullKey, value: prevVal, line: lineNum++ })
      } else if (prevVal !== currVal) {
        lines.push({ type: 'removed', key: fullKey, value: prevVal, line: lineNum++ })
        lines.push({ type: 'added',   key: fullKey, value: currVal, line: lineNum++ })
      } else {
        lines.push({ type: 'unchanged', key: fullKey, value: currVal, line: lineNum++ })
      }
    }

    return lines
  }

  private diffHeaders(
    prev: Record<string, string>,
    curr: Record<string, string>
  ): DiffLine[] {
    return this.diffObjects(prev as Record<string, unknown>, curr as Record<string, unknown>)
  }

  private diffText(prev: string, curr: string): DiffLine[] {
    const prevLines = prev.split('\n')
    const currLines = curr.split('\n')
    const result: DiffLine[] = []

    const maxLen = Math.max(prevLines.length, currLines.length)
    for (let i = 0; i < maxLen; i++) {
      const p = prevLines[i]
      const c = currLines[i]
      if (p === undefined) {
        result.push({ type: 'added',     value: c, line: i })
      } else if (c === undefined) {
        result.push({ type: 'removed',   value: p, line: i })
      } else if (p !== c) {
        result.push({ type: 'removed',   value: p, line: i })
        result.push({ type: 'added',     value: c, line: i })
      } else {
        result.push({ type: 'unchanged', value: p, line: i })
      }
    }
    return result
  }
}
