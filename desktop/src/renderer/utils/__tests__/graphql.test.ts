import { describe, it, expect } from 'vitest'
import { extractGraphQLInfo, hasGraphQLErrors } from '../graphql'
import type { NetworkRequest } from '../../types/network'

function makeRequest(overrides: Partial<NetworkRequest> = {}): NetworkRequest {
  return {
    id: '1',
    method: 'POST',
    url: 'https://api.example.com/graphql',
    requestHeaders: {},
    requestBody: null,
    responseHeaders: {},
    responseBody: null,
    statusCode: 200,
    duration: 100,
    responseSize: 0,
    startTime: 0,
    endTime: 100,
    status: 'completed',
    error: null,
    source: 'fetch',
    ...overrides
  }
}

describe('extractGraphQLInfo', () => {
  it('retorna null para requisições que não são GraphQL', () => {
    expect(extractGraphQLInfo(makeRequest({ requestBody: { foo: 'bar' } }))).toBeNull()
    expect(extractGraphQLInfo(makeRequest({ requestBody: null }))).toBeNull()
  })

  it('usa operationName quando presente', () => {
    const info = extractGraphQLInfo(
      makeRequest({
        requestBody: { query: 'query GetUser { user { id } }', operationName: 'GetUser' }
      })
    )
    expect(info?.operationName).toBe('GetUser')
    expect(info?.operationType).toBe('query')
  })

  it('extrai nome e tipo do documento quando operationName falta', () => {
    const info = extractGraphQLInfo(
      makeRequest({ requestBody: { query: 'mutation CreatePost { createPost { id } }' } })
    )
    expect(info?.operationName).toBe('CreatePost')
    expect(info?.operationType).toBe('mutation')
  })

  it('reconhece subscription', () => {
    const info = extractGraphQLInfo(
      makeRequest({ requestBody: { query: 'subscription OnMessage { message { id } }' } })
    )
    expect(info?.operationType).toBe('subscription')
  })

  it('trata shorthand como query anônima', () => {
    const info = extractGraphQLInfo(makeRequest({ requestBody: { query: '{ user { id } }' } }))
    expect(info?.operationType).toBe('query')
    expect(info?.operationName).toBe('anonymous')
  })

  it('aceita body como string JSON', () => {
    const info = extractGraphQLInfo(
      makeRequest({ requestBody: JSON.stringify({ query: 'query Foo { a }' }) })
    )
    expect(info?.operationName).toBe('Foo')
  })

  it('expõe variables', () => {
    const info = extractGraphQLInfo(
      makeRequest({ requestBody: { query: 'query Foo($id: ID!) { a }', variables: { id: '7' } } })
    )
    expect(info?.variables).toEqual({ id: '7' })
  })

  it('ignora comentários antes da operação', () => {
    const info = extractGraphQLInfo(
      makeRequest({ requestBody: { query: '# comentário\nquery Real { a }' } })
    )
    expect(info?.operationName).toBe('Real')
  })
})

describe('hasGraphQLErrors', () => {
  it('detecta erro em resposta 200 — o caso que passava despercebido', () => {
    const request = makeRequest({
      statusCode: 200,
      requestBody: { query: 'query Foo { a }' },
      responseBody: { data: null, errors: [{ message: 'Campo inválido' }] }
    })

    expect(hasGraphQLErrors(request)).toBe(true)
    expect(extractGraphQLInfo(request)?.errors).toEqual(['Campo inválido'])
  })

  it('não acusa erro quando errors está ausente ou vazio', () => {
    expect(
      hasGraphQLErrors(
        makeRequest({ requestBody: { query: 'query Foo { a }' }, responseBody: { data: {} } })
      )
    ).toBe(false)

    expect(
      hasGraphQLErrors(
        makeRequest({ requestBody: { query: 'query Foo { a }' }, responseBody: { errors: [] } })
      )
    ).toBe(false)
  })

  it('serializa erro sem campo message', () => {
    const info = extractGraphQLInfo(
      makeRequest({
        requestBody: { query: 'query Foo { a }' },
        responseBody: { errors: [{ code: 500 }] }
      })
    )
    expect(info?.errors?.[0]).toContain('500')
  })
})
