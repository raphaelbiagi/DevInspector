import type {
  HttpRequestPayload,
  HttpResponsePayload,
  ConsolePayload,
  AnomalyPayload,
} from './protocol'

interface AnomalyDetectorConfig {
  slowRequestThresholdMs: number       // default: 2000
  largeResponseThresholdBytes: number  // default: 500_000
  consoleFloodWindowMs: number         // default: 3000
  consoleFloodMaxCount: number         // default: 10
  onAnomaly: (anomaly: AnomalyPayload) => void
}

const DEFAULT_CONFIG: AnomalyDetectorConfig = {
  slowRequestThresholdMs: 2000,
  largeResponseThresholdBytes: 500_000,
  consoleFloodWindowMs: 3000,
  consoleFloodMaxCount: 10,
  onAnomaly: () => {},
}

export class AnomalyDetector {
  private config: AnomalyDetectorConfig
  // Rastreia mensagens de console para detectar floods
  private consoleHistory: Map<string, number[]> = new Map()

  constructor(config: Partial<AnomalyDetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  analyzeResponse(
    request: HttpRequestPayload,
    response: HttpResponsePayload
  ): void {
    // Request lenta
    if (response.duration > this.config.slowRequestThresholdMs) {
      this.emit({
        id: crypto.randomUUID(),
        type: 'slow_request',
        severity: response.duration > this.config.slowRequestThresholdMs * 2 ? 'critical' : 'warning',
        relatedId: request.id,
        description: `${request.method} ${request.url} levou ${response.duration}ms (threshold: ${this.config.slowRequestThresholdMs}ms)`,
        timestamp: Date.now(),
      })
    }

    // Response grande
    if (response.size && response.size > this.config.largeResponseThresholdBytes) {
      const kb = Math.round(response.size / 1024)
      this.emit({
        id: crypto.randomUUID(),
        type: 'large_response',
        severity: response.size > this.config.largeResponseThresholdBytes * 2 ? 'critical' : 'warning',
        relatedId: request.id,
        description: `Response de ${kb}KB recebida de ${request.url}`,
        timestamp: Date.now(),
      })
    }

    // Status de erro
    if (response.statusCode >= 400) {
      this.emit({
        id: crypto.randomUUID(),
        type: 'error_status',
        severity: response.statusCode >= 500 ? 'critical' : 'warning',
        relatedId: request.id,
        description: `${response.statusCode} ${response.statusText} — ${request.method} ${request.url}`,
        timestamp: Date.now(),
      })
    }
  }

  analyzeConsole(entry: ConsolePayload): void {
    if (entry.level !== 'error' && entry.level !== 'warn') return

    const key = this.normalizeMessage(entry.message)
    const now = Date.now()
    const window = this.config.consoleFloodWindowMs

    if (!this.consoleHistory.has(key)) {
      this.consoleHistory.set(key, [])
    }

    const timestamps = this.consoleHistory.get(key)!
    // Remove entradas fora da janela de tempo
    const recent = timestamps.filter(t => now - t < window)
    recent.push(now)
    this.consoleHistory.set(key, recent)

    if (recent.length === this.config.consoleFloodMaxCount) {
      this.emit({
        id: crypto.randomUUID(),
        type: 'console_flood',
        severity: 'warning',
        relatedId: entry.id,
        description: `"${entry.message.slice(0, 80)}" apareceu ${recent.length}x nos últimos ${window / 1000}s`,
        timestamp: now,
      })
    }

    // Limpa histórico antigo periodicamente
    if (this.consoleHistory.size > 1000) {
      this.pruneHistory(now, window)
    }
  }

  private emit(anomaly: AnomalyPayload): void {
    this.config.onAnomaly(anomaly)
  }

  private normalizeMessage(message: string): string {
    // Remove números e UUIDs para agrupar mensagens similares
    return message
      .replace(/\d+/g, 'N')
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
      .slice(0, 120)
  }

  private pruneHistory(now: number, windowMs: number): void {
    const entries = Array.from(this.consoleHistory.entries())
    for (const [key, timestamps] of entries) {
      const recent = timestamps.filter((t: number) => now - t < windowMs)
      if (recent.length === 0) {
        this.consoleHistory.delete(key)
      } else {
        this.consoleHistory.set(key, recent)
      }
    }
  }
}
