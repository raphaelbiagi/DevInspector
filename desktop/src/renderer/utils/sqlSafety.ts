/**
 * Classificação de risco de comandos SQL.
 *
 * O executor abre o arquivo em modo leitura/escrita e roda qualquer comando que
 * não seja SELECT/PRAGMA/EXPLAIN/WITH. Em um banco local isso age sobre o
 * arquivo real do usuário, sem transação e sem desfazer — então comandos que
 * apagam dados ou estrutura passam antes por uma confirmação explícita.
 */

export type SqlRisk = 'read' | 'write' | 'destructive'

/** Remove comentários e literais para não classificar por texto dentro de strings. */
function stripNoise(sql: string): string {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/"(?:[^"]|"")*"/g, '""')
}

function classifyStatement(statement: string): SqlRisk {
  const sql = statement.trim()
  if (!sql) return 'read'

  const upper = sql.toUpperCase()

  if (/^(SELECT|PRAGMA|EXPLAIN|WITH)\b/.test(upper)) return 'read'

  // Estrutura: sempre irreversível
  if (/^(DROP|TRUNCATE|ALTER|REINDEX|VACUUM)\b/.test(upper)) return 'destructive'

  // DELETE / UPDATE sem WHERE atingem a tabela inteira
  if (/^DELETE\b/.test(upper) && !/\bWHERE\b/.test(upper)) return 'destructive'
  if (/^UPDATE\b/.test(upper) && !/\bWHERE\b/.test(upper)) return 'destructive'

  if (/^(INSERT|UPDATE|DELETE|REPLACE|CREATE)\b/.test(upper)) return 'write'

  return 'write'
}

export interface SqlRiskAssessment {
  risk: SqlRisk
  /** Comandos que motivaram a classificação, para exibir na confirmação. */
  statements: string[]
}

export function assessSql(query: string): SqlRiskAssessment {
  const cleaned = stripNoise(query)
  const statements = cleaned
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)

  let risk: SqlRisk = 'read'
  const flagged: string[] = []

  for (const statement of statements) {
    const statementRisk = classifyStatement(statement)

    if (statementRisk === 'destructive') {
      risk = 'destructive'
      flagged.push(statement)
    } else if (statementRisk === 'write' && risk !== 'destructive') {
      risk = 'write'
      flagged.push(statement)
    }
  }

  return { risk, statements: flagged }
}

/** Resumo curto para caber no diálogo de confirmação. */
export function describeStatement(statement: string, maxLength = 120): string {
  const singleLine = statement.replace(/\s+/g, ' ').trim()
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength)}…` : singleLine
}
