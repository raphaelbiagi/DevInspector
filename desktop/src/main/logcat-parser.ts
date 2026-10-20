// ============================================================
// Parser do formato `adb logcat -v threadtime`
//   10-19 14:03:22.123  1234  5678 I ReactNativeJS: mensagem
// ============================================================

export type LogcatLevel = 'V' | 'D' | 'I' | 'W' | 'E' | 'F'

export interface LogcatEntry {
  id: number
  timestamp: number   // epoch ms, reconstruído a partir de MM-DD (logcat não imprime o ano)
  time: string        // HH:MM:SS.mmm como o dispositivo imprimiu
  pid: number
  tid: number
  level: LogcatLevel
  tag: string
  message: string
}

export interface LogcatDevice {
  serial: string
  state: string       // 'device' | 'unauthorized' | 'offline' | ...
  model: string | null
}

const THREADTIME_RE =
  /^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+(\d+)\s+(\d+)\s+([VDIWEFS])\s+(.*?)\s*:(?: (.*))?$/

/**
 * Converte uma linha em entrada. Devolve null para o que não é log: os
 * separadores "--------- beginning of main" e linhas truncadas.
 */
export function parseLogcatLine(line: string, id: number, now: Date = new Date()): LogcatEntry | null {
  const m = THREADTIME_RE.exec(line)
  if (!m) return null

  const [, month, day, hh, mm, ss, ms, pid, tid, rawLevel, tag, message] = m
  const date = new Date(now.getFullYear(), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss), Number(ms))
  // Buffer lido logo após a virada do ano: "12-31" visto em 1º de janeiro é do ano anterior.
  if (date.getTime() - now.getTime() > 24 * 60 * 60 * 1000) {
    date.setFullYear(date.getFullYear() - 1)
  }

  return {
    id,
    timestamp: date.getTime(),
    time: `${hh}:${mm}:${ss}.${ms}`,
    pid: Number(pid),
    tid: Number(tid),
    // 'S' (silent) nunca deveria aparecer na saída; tratado como verbose por segurança.
    level: rawLevel === 'S' ? 'V' : (rawLevel as LogcatLevel),
    tag: tag.trim(),
    message: message ?? ''
  }
}

/**
 * O logcat quebra mensagens multilinha (stack traces, JSON) em várias linhas
 * com cabeçalho idêntico. Juntá-las de volta deixa um crash como uma única
 * entrada em vez de quarenta.
 */
export function isContinuation(prev: LogcatEntry, next: LogcatEntry): boolean {
  return (
    prev.pid === next.pid &&
    prev.tid === next.tid &&
    prev.level === next.level &&
    prev.tag === next.tag &&
    prev.time === next.time
  )
}

/** Saída de `adb devices -l`. */
export function parseAdbDevices(output: string): LogcatDevice[] {
  // Sem slice(1): na primeira chamada o adb imprime "* daemon started" antes do cabeçalho.
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('*') && !line.startsWith('List of devices'))
    .map((line) => {
      const [serial, state, ...props] = line.split(/\s+/)
      const modelProp = props.find((p) => p.startsWith('model:'))
      return {
        serial,
        state: state ?? 'unknown',
        model: modelProp ? modelProp.slice('model:'.length).replace(/_/g, ' ') : null
      }
    })
}

/** Saída de `pm list packages` ("package:com.foo"). */
export function parsePackageList(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('package:'))
    .map((line) => line.slice('package:'.length))
    .sort()
}

/** Saída de `pidof` ("1234 5678") ou vazio quando o processo não está rodando. */
export function parsePidList(output: string): number[] {
  return output
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0)
}
