import { describe, it, expect } from 'vitest'
import { buildSearchMatcher } from '../searchMatcher'
import type { NetworkRequest } from '../../types/network'

function makeRequest(overrides: Partial<NetworkRequest> = {}): NetworkRequest {
  return {
    id: '1',
    method: 'POST',
    url: 'https://api.example.com/users',
    requestHeaders: { Authorization: 'Bearer abc123' },
    requestBody: { userId: 42 },
    responseHeaders: { 'content-type': 'application/json' },
    responseBody: { nome: 'Ana' },
    statusCode: 201,
    duration: 50,
    responseSize: 10,
    startTime: 0,
    endTime: 50,
    status: 'completed',
    error: null,
    source: 'fetch',
    ...overrides
  }
}

describe('buildSearchMatcher', () => {
  it('sem termo, aceita tudo', () => {
    expect(buildSearchMatcher('')(makeRequest())).toBe(true)
    expect(buildSearchMatcher('   ')(makeRequest())).toBe(true)
  })

  it('escopo url busca apenas na URL', () => {
    const matcher = buildSearchMatcher('users', 'url')
    expect(matcher(makeRequest())).toBe(true)

    // O valor está no body, não na URL — não deve casar no escopo "url"
    expect(buildSearchMatcher('42', 'url')(makeRequest())).toBe(false)
  })

  it('escopo all alcança body, headers e status', () => {
    expect(buildSearchMatcher('42', 'all')(makeRequest())).toBe(true)
    expect(buildSearchMatcher('Bearer', 'all')(makeRequest())).toBe(true)
    expect(buildSearchMatcher('Ana', 'all')(makeRequest())).toBe(true)
    expect(buildSearchMatcher('201', 'all')(makeRequest())).toBe(true)
  })

  it('é case-insensitive', () => {
    expect(buildSearchMatcher('USERS', 'url')(makeRequest())).toBe(true)
    expect(buildSearchMatcher('ana', 'all')(makeRequest())).toBe(true)
  })

  it('aceita regex no formato /padrao/', () => {
    expect(buildSearchMatcher('/users$/', 'url')(makeRequest())).toBe(true)
    expect(buildSearchMatcher('/^https/', 'url')(makeRequest())).toBe(true)
    expect(buildSearchMatcher('/naoexiste/', 'url')(makeRequest())).toBe(false)
  })

  it('regex inválida cai para busca literal em vez de quebrar', () => {
    const matcher = buildSearchMatcher('/[unclosed/', 'url')
    expect(() => matcher(makeRequest())).not.toThrow()
    expect(matcher(makeRequest())).toBe(false)
  })

  it('regex com flag g não perde resultados entre chamadas', () => {
    const matcher = buildSearchMatcher('/users/g', 'url')
    const request = makeRequest()
    // Com 'g' preservado, a segunda chamada retornaria false por causa do lastIndex
    expect(matcher(request)).toBe(true)
    expect(matcher(request)).toBe(true)
  })

  it('busca em erro de rede', () => {
    const request = makeRequest({ status: 'error', error: 'Timeout exceeded' })
    expect(buildSearchMatcher('timeout', 'all')(request)).toBe(true)
  })

  it('não quebra com body nulo', () => {
    const request = makeRequest({ requestBody: null, responseBody: null })
    expect(() => buildSearchMatcher('x', 'all')(request)).not.toThrow()
  })
})
