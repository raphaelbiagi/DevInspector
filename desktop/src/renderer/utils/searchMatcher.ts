import type { NetworkRequest } from '../types/network'

/**
 * Onde a busca do painel Network procura. "url" é o comportamento histórico e
 * continua sendo o padrão por ser o mais rápido; "all" alcança headers e body,
 * necessário para achar a requisição que carregava um certo id ou token.
 */
export type SearchScope = 'url' | 'all'

const REGEX_PATTERN = /^\/(.*)\/([gimsuy]*)$/

/**
 * Serializa apenas o necessário para a busca, com teto de tamanho: um body de
 * vários MB não deve custar uma varredura completa a cada tecla digitada.
 */
const MAX_SEARCHABLE_BODY = 50_000

function bodyToSearchable(body: unknown): string {
  if (body === null || body === undefined) return ''
  if (typeof body === 'string') return body.slice(0, MAX_SEARCHABLE_BODY)
  try {
    return JSON.stringify(body).slice(0, MAX_SEARCHABLE_BODY)
  } catch {
    return ''
  }
}

function headersToSearchable(headers: Record<string, string> | undefined): string {
  if (!headers) return ''
  let out = ''
  for (const [key, value] of Object.entries(headers)) {
    out += `${key}: ${value}\n`
  }
  return out
}

function buildHaystack(request: NetworkRequest, scope: SearchScope): string {
  if (scope === 'url') return request.url

  return [
    request.url,
    request.method,
    request.statusCode !== null ? String(request.statusCode) : '',
    request.error ?? '',
    headersToSearchable(request.requestHeaders),
    headersToSearchable(request.responseHeaders),
    bodyToSearchable(request.requestBody),
    bodyToSearchable(request.responseBody)
  ].join('\n')
}

/**
 * Monta o predicado de busca. Aceita `/padrao/flags` para regex; qualquer outra
 * coisa é tratada como substring case-insensitive.
 */
export function buildSearchMatcher(
  search: string,
  scope: SearchScope = 'url'
): (request: NetworkRequest) => boolean {
  const term = search.trim()
  if (!term) return () => true

  const asRegex = term.match(REGEX_PATTERN)
  if (asRegex) {
    try {
      // 'g' guarda estado em .test() entre chamadas — removido para não pular resultados
      const flags = asRegex[2].replace(/g/g, '')
      const regex = new RegExp(asRegex[1], flags.includes('i') ? flags : flags + 'i')
      return (request) => regex.test(buildHaystack(request, scope))
    } catch {
      // Regex inválida (usuário ainda digitando): cai para busca literal
    }
  }

  const needle = term.toLowerCase()
  return (request) => buildHaystack(request, scope).toLowerCase().includes(needle)
}
