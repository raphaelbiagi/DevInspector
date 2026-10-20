// Espelho de src/main/logcat-parser.ts e src/main/logcatManager.ts

export type LogcatLevel = 'V' | 'D' | 'I' | 'W' | 'E' | 'F'

export interface LogcatEntry {
  id: number
  timestamp: number
  time: string
  pid: number
  tid: number
  level: LogcatLevel
  tag: string
  message: string
}

export interface LogcatDevice {
  serial: string
  state: string
  model: string | null
}

export interface LogcatStatus {
  running: boolean
  serial: string | null
  packageName: string | null
  pids: number[]
  error: string | null
}
