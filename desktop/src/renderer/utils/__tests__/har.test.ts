import { describe, it, expect } from 'vitest'
import { buildHar } from '../har'
import type { NetworkRequest } from '../../types/network'

function makeRequest(overrides: Partial<NetworkRequest> = {}): NetworkRequest {
  return {
    id: '1',
    method: 'GET',
    url: 'https://api.example.com/users?page=2&q=jo%C3%A3o',
    requestHeaders: { Accept: 'application/json' },
    requestBody: null,
    responseHeaders: { 'content-type': 'application/json' },
    responseBody: { ok: true },
    statusCode: 200,
    duration: 123,
    responseSize: 456,
    startTime: 1700000000000,
    endTime: 1700000000123,
    status: 'completed',
    error: null,
    source: 'fetch',
    ...overrides
  }
}

describe('buildHar', () => {
  it('gera estrutura HAR 1.2 válida', () => {
    const har = JSON.parse(buildHar([makeRequest()], '1.0.9'))

    expect(har.log.version).toBe('1.2')
    expect(har.log.creator.name).toBe('DevInspector')
    expect(har.log.creator.version).toBe('1.0.9')
    expect(har.log.entries).toHaveLength(1)
  })

  it('converte headers para lista nome/valor', () => {
    const har = JSON.parse(buildHar([makeRequest()], '1.0.0'))
    expect(har.log.entries[0].request.headers).toEqual([
      { name: 'Accept', value: 'application/json' }
    ])
  })

  it('decodifica a query string da URL', () => {
    const har = JSON.parse(buildHar([makeRequest()], '1.0.0'))
    expect(har.log.entries[0].request.queryString).toEqual([
      { name: 'page', value: '2' },
      { name: 'q', value: 'joão' }
    ])
  })

  it('usa status 0 para requisição que falhou antes da resposta', () => {
    const har = JSON.parse(
      buildHar([makeRequest({ statusCode: null, status: 'error', error: 'Network failed' })], '1.0.0')
    )
    expect(har.log.entries[0].response.status).toBe(0)
    expect(har.log.entries[0].response.statusText).toBe('Network failed')
  })

  it('serializa body de objeto como texto', () => {
    const har = JSON.parse(
      buildHar([makeRequest({ method: 'POST', requestBody: { name: 'ana' } })], '1.0.0')
    )
    expect(har.log.entries[0].request.postData.text).toBe('{"name":"ana"}')
  })

  it('omite postData quando não há corpo', () => {
    const har = JSON.parse(buildHar([makeRequest()], '1.0.0'))
    expect(har.log.entries[0].request.postData).toBeUndefined()
  })

  it('ordena as entradas por horário de início', () => {
    const har = JSON.parse(
      buildHar(
        [
          makeRequest({ id: 'b', startTime: 2000 }),
          makeRequest({ id: 'a', startTime: 1000 })
        ],
        '1.0.0'
      )
    )
    expect(har.log.entries.map((e: any) => e._devinspector.id)).toEqual(['a', 'b'])
  })

  it('usa startedDateTime em ISO 8601', () => {
    const har = JSON.parse(buildHar([makeRequest()], '1.0.0'))
    expect(har.log.entries[0].startedDateTime).toBe(new Date(1700000000000).toISOString())
  })

  it('lida com lista vazia', () => {
    const har = JSON.parse(buildHar([], '1.0.0'))
    expect(har.log.entries).toEqual([])
  })
})
