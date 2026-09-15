import type { NetworkRequest } from '../types/network'

/**
 * Reconhecimento de GraphQL.
 *
 * Sem isso toda operação aparece como um `POST /graphql` indistinguível das
 * outras, e erros passam despercebidos: GraphQL responde **200** mesmo quando
 * falha, colocando o problema dentro de `errors` no corpo.
 */

export interface GraphQLInfo {
  operationName: string
  operationType: 'query' | 'mutation' | 'subscription'
  variables?: Record<string, unknown>
  /** Mensagens do array `errors` da resposta, se houver. */
  errors?: string[]
}

function asObject(body: unknown): Record<string, any> | null {
  if (!body) return null
  if (typeof body === 'object') return body as Record<string, any>
  if (typeof body === 'string') {
    try {
      const parsed = JSON.parse(body)
      return typeof parsed === 'object' && parsed !== null ? parsed : null
    } catch {
      return null
    }
  }
  return null
}

/** Extrai tipo e nome da operação do documento GraphQL quando `operationName` não vem no payload. */
function parseOperationFromQuery(query: string): { type: GraphQLInfo['operationType']; name: string } {
  // Pula comentários e espaços iniciais até a primeira palavra significativa
  const cleaned = query.replace(/#[^\n]*/g, ' ').trim()
  const match = cleaned.match(/^\s*(query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)?/i)

  if (match) {
    return {
      type: match[1].toLowerCase() as GraphQLInfo['operationType'],
      name: match[2] || 'anonymous'
    }
  }

  // Shorthand `{ campo }` é sempre uma query
  if (cleaned.startsWith('{')) return { type: 'query', name: 'anonymous' }

  return { type: 'query', name: 'anonymous' }
}

export function extractGraphQLInfo(request: NetworkRequest): GraphQLInfo | null {
  const requestBody = asObject(request.requestBody)
  if (!requestBody) return null

  // Requisições em lote (array de operações) não são detalhadas aqui
  const query = requestBody.query
  if (typeof query !== 'string' || !query.trim()) return null

  const parsed = parseOperationFromQuery(query)
  const operationName =
    typeof requestBody.operationName === 'string' && requestBody.operationName
      ? requestBody.operationName
      : parsed.name

  const info: GraphQLInfo = {
    operationName,
    operationType: parsed.type,
    variables:
      requestBody.variables && typeof requestBody.variables === 'object'
        ? (requestBody.variables as Record<string, unknown>)
        : undefined
  }

  const responseBody = asObject(request.responseBody)
  if (responseBody && Array.isArray(responseBody.errors) && responseBody.errors.length > 0) {
    info.errors = responseBody.errors.map((e: any) =>
      typeof e?.message === 'string' ? e.message : JSON.stringify(e)
    )
  }

  return info
}

/** Uma resposta 200 com `errors` preenchido é, na prática, uma falha. */
export function hasGraphQLErrors(request: NetworkRequest): boolean {
  const info = extractGraphQLInfo(request)
  return !!info?.errors?.length
}
