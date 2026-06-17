export type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'table'

export interface SerializedValue {
  type: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'object' | 'array' | 'error' | 'function' | 'symbol' | 'bigint'
  value: unknown
  preview?: string
}

export interface ConsoleLogEntry {
  id: string
  level: LogLevel
  args: SerializedValue[]
  timestamp: number
  stackTrace: string | null
}

export interface ConsoleFilter {
  levels: Set<LogLevel>
  search: string
}
