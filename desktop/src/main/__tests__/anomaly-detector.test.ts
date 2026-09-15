import { describe, it, expect, vi } from 'vitest'
import { AnomalyDetector } from '../anomaly-detector'
import type { HttpRequestPayload, HttpResponsePayload, ConsolePayload } from '../protocol'

function makeRequest(overrides: Partial<HttpRequestPayload> = {}): HttpRequestPayload {
  return {
    id: 'req-1',
    method: 'GET',
    url: 'https://api.example.com/users',
    headers: {},
    timestamp: Date.now(),
    sessionId: 's1',
    ...overrides
  }
}

function makeResponse(overrides: Partial<HttpResponsePayload> = {}): HttpResponsePayload {
  return {
    requestId: 'req-1',
    statusCode: 200,
    statusText: 'OK',
    headers: {},
    duration: 100,
    size: 1000,
    timestamp: Date.now(),
    sessionId: 's1',
    ...overrides
  }
}

function makeConsole(overrides: Partial<ConsolePayload> = {}): ConsolePayload {
  return {
    id: 'log-1',
    level: 'error',
    args: [],
    message: 'Falha ao carregar',
    timestamp: Date.now(),
    sessionId: 's1',
    ...overrides
  }
}

describe('AnomalyDetector — requisições', () => {
  it('não acusa nada numa resposta normal', () => {
    const onAnomaly = vi.fn()
    new AnomalyDetector({ onAnomaly }).analyzeResponse(makeRequest(), makeResponse())
    expect(onAnomaly).not.toHaveBeenCalled()
  })

  it('detecta requisição lenta acima do threshold', () => {
    const onAnomaly = vi.fn()
    const detector = new AnomalyDetector({ onAnomaly, slowRequestThresholdMs: 2000 })

    detector.analyzeResponse(makeRequest(), makeResponse({ duration: 2500 }))

    expect(onAnomaly).toHaveBeenCalledTimes(1)
    expect(onAnomaly.mock.calls[0][0]).toMatchObject({ type: 'slow_request', severity: 'warning' })
  })

  it('classifica como crítico ao dobrar o threshold', () => {
    const onAnomaly = vi.fn()
    const detector = new AnomalyDetector({ onAnomaly, slowRequestThresholdMs: 1000 })

    detector.analyzeResponse(makeRequest(), makeResponse({ duration: 2500 }))

    expect(onAnomaly.mock.calls[0][0].severity).toBe('critical')
  })

  it('detecta resposta grande', () => {
    const onAnomaly = vi.fn()
    const detector = new AnomalyDetector({ onAnomaly, largeResponseThresholdBytes: 1000 })

    detector.analyzeResponse(makeRequest(), makeResponse({ size: 5000 }))

    expect(onAnomaly.mock.calls.some((c) => c[0].type === 'large_response')).toBe(true)
  })

  it('detecta status de erro e usa severidade maior em 5xx', () => {
    const onAnomaly = vi.fn()
    const detector = new AnomalyDetector({ onAnomaly })

    detector.analyzeResponse(makeRequest(), makeResponse({ statusCode: 404 }))
    detector.analyzeResponse(makeRequest(), makeResponse({ statusCode: 500 }))

    const severities = onAnomaly.mock.calls
      .filter((c) => c[0].type === 'error_status')
      .map((c) => c[0].severity)

    expect(severities).toEqual(['warning', 'critical'])
  })

  it('relaciona a anomalia ao id da requisição', () => {
    const onAnomaly = vi.fn()
    new AnomalyDetector({ onAnomaly }).analyzeResponse(
      makeRequest({ id: 'abc' }),
      makeResponse({ statusCode: 500 })
    )
    expect(onAnomaly.mock.calls[0][0].relatedId).toBe('abc')
  })
})

describe('AnomalyDetector — console', () => {
  it('ignora níveis que não são warn/error', () => {
    const onAnomaly = vi.fn()
    const detector = new AnomalyDetector({ onAnomaly, consoleFloodMaxCount: 2 })

    detector.analyzeConsole(makeConsole({ level: 'log' }))
    detector.analyzeConsole(makeConsole({ level: 'log' }))
    detector.analyzeConsole(makeConsole({ level: 'log' }))

    expect(onAnomaly).not.toHaveBeenCalled()
  })

  it('dispara flood ao atingir a contagem dentro da janela', () => {
    const onAnomaly = vi.fn()
    const detector = new AnomalyDetector({
      onAnomaly,
      consoleFloodMaxCount: 3,
      consoleFloodWindowMs: 5000
    })

    detector.analyzeConsole(makeConsole())
    detector.analyzeConsole(makeConsole())
    expect(onAnomaly).not.toHaveBeenCalled()

    detector.analyzeConsole(makeConsole())
    expect(onAnomaly).toHaveBeenCalledTimes(1)
    expect(onAnomaly.mock.calls[0][0].type).toBe('console_flood')
  })

  it('agrupa mensagens que só diferem por números e UUIDs', () => {
    const onAnomaly = vi.fn()
    const detector = new AnomalyDetector({ onAnomaly, consoleFloodMaxCount: 2 })

    detector.analyzeConsole(makeConsole({ message: 'Falha no item 1' }))
    detector.analyzeConsole(makeConsole({ message: 'Falha no item 2' }))

    expect(onAnomaly).toHaveBeenCalledTimes(1)
  })

  it('não agrupa mensagens genuinamente diferentes', () => {
    const onAnomaly = vi.fn()
    const detector = new AnomalyDetector({ onAnomaly, consoleFloodMaxCount: 2 })

    detector.analyzeConsole(makeConsole({ message: 'Erro de rede' }))
    detector.analyzeConsole(makeConsole({ message: 'Erro de parsing' }))

    expect(onAnomaly).not.toHaveBeenCalled()
  })

  it('não conta ocorrências fora da janela de tempo', () => {
    const onAnomaly = vi.fn()
    const detector = new AnomalyDetector({
      onAnomaly,
      consoleFloodMaxCount: 2,
      consoleFloodWindowMs: 1000
    })

    const now = Date.now()
    const spy = vi.spyOn(Date, 'now')

    spy.mockReturnValue(now)
    detector.analyzeConsole(makeConsole())

    // 2 segundos depois: a primeira ocorrência já saiu da janela de 1s
    spy.mockReturnValue(now + 2000)
    detector.analyzeConsole(makeConsole())

    expect(onAnomaly).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
