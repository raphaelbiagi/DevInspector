import type { LogcatEntry, LogcatLevel } from '../types/logcat'

export const LOGCAT_LEVELS: LogcatLevel[] = ['V', 'D', 'I', 'W', 'E', 'F']

export const LOGCAT_LEVEL_INFO: Record<LogcatLevel, { label: string; hint: string }> = {
  V: { label: 'Detalhado', hint: 'Verbose (V): detalhes internos, muito volume. Raramente útil.' },
  D: { label: 'Debug', hint: 'Debug (D): mensagens de depuração de bibliotecas e do sistema.' },
  I: { label: 'Info', hint: 'Info (I): informativos. O console.log do seu JS aparece aqui, com a tag ReactNativeJS.' },
  W: { label: 'Aviso', hint: 'Warning (W): algo estranho, mas não quebrou.' },
  E: { label: 'Erro', hint: 'Error (E): falhas. Crashes do app aparecem aqui com a tag AndroidRuntime.' },
  F: { label: 'Fatal', hint: 'Fatal (F): falha grave do sistema ou do código nativo.' }
}

/**
 * Níveis ligados/desligados individualmente, como na aba Console, e uma busca
 * onde `tag:Foo` restringe à tag e o resto procura em tag + mensagem.
 * `-termo` exclui. Ex.: `tag:ReactNativeJS -Reanimated erro`.
 */
export function filterLogcatEntries(entries: LogcatEntry[], levels: Set<LogcatLevel>, search: string): LogcatEntry[] {
  const allLevels = LOGCAT_LEVELS.every((l) => levels.has(l))
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean)

  const tagIncludes: string[] = []
  const tagExcludes: string[] = []
  const textIncludes: string[] = []
  const textExcludes: string[] = []
  for (const token of tokens) {
    const negated = token.startsWith('-') && token.length > 1
    const body = negated ? token.slice(1) : token
    if (body.startsWith('tag:')) {
      const tag = body.slice(4)
      if (tag) (negated ? tagExcludes : tagIncludes).push(tag)
    } else {
      ;(negated ? textExcludes : textIncludes).push(body)
    }
  }

  if (allLevels && tokens.length === 0) return entries

  return entries.filter((e) => {
    if (!levels.has(e.level)) return false
    if (tokens.length === 0) return true

    const tag = e.tag.toLowerCase()
    if (tagIncludes.length && !tagIncludes.some((t) => tag.includes(t))) return false
    if (tagExcludes.some((t) => tag.includes(t))) return false

    if (textIncludes.length || textExcludes.length) {
      const haystack = `${tag} ${e.message.toLowerCase()}`
      if (!textIncludes.every((t) => haystack.includes(t))) return false
      if (textExcludes.some((t) => haystack.includes(t))) return false
    }
    return true
  })
}

/** Primeira linha de um crash Java/Kotlin, emitida pelo próprio processo do app. */
export function isFatalException(entry: LogcatEntry): boolean {
  return entry.tag === 'AndroidRuntime' && entry.level === 'E' && entry.message.startsWith('FATAL EXCEPTION')
}
