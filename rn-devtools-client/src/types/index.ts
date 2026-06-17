export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS' | 'CONNECT' | 'TRACE'
export type RequestStatus = 'pending' | 'completed' | 'error' | 'cancelled' | 'timeout'
export type RequestSource = 'fetch' | 'xhr'
export type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'table' | 'fatal'
export type ConnectionStatus = 'discovering' | 'connected' | 'disconnected' | 'retrying'

export interface SerializedValue {
  type: 'string' | 'number' | 'boolean' | 'null' | 'undefined' | 'object' | 'array' | 'error' | 'function' | 'symbol' | 'bigint'
  value: unknown
  preview?: string
}

export interface NetworkRequestStartPayload {
  id: string
  method: HttpMethod
  url: string
  requestHeaders: Record<string, string>
  requestBody: unknown
  startTime: number
  source: RequestSource
}

export interface NetworkRequestEndPayload {
  id: string
  statusCode: number
  responseHeaders: Record<string, string>
  responseBody: unknown
  responseSize: number | null
  endTime: number
  duration: number
}

export interface NetworkRequestErrorPayload {
  id: string
  error: string
  endTime: number
  duration: number
}

export interface ConsoleLogEntry {
  id: string
  level: LogLevel
  args: SerializedValue[]
  timestamp: number
  stackTrace: string | null
}

export interface ClientInfo {
  platform: string
  appName: string
}

// --- Tipo unificado de evento do protocolo ---

export type DevInspectorEvent =
  | { type: 'session:handshake';   payload: Record<string, unknown> }
  | { type: 'console:entry';       payload: Record<string, unknown> }
  | { type: 'http:request';        payload: Record<string, unknown> }
  | { type: 'http:response';       payload: Record<string, unknown> }
  | { type: 'network:merged';      payload: Record<string, unknown> }

// --- Tipo legado (mantido para compatibilidade) ---

export type ClientMessage =
  | { type: 'network:request-start'; payload: NetworkRequestStartPayload }
  | { type: 'network:request-end'; payload: NetworkRequestEndPayload }
  | { type: 'network:request-error'; payload: NetworkRequestErrorPayload }
  | { type: 'console:log'; payload: ConsoleLogEntry }
  | { type: 'client:info'; payload: ClientInfo }

// --- Tipos de Banco de Dados ---

export interface DatabaseDriver {
  getDatabases: () => Promise<string[]>
  getTables: (dbName: string) => Promise<string[]>
  executeSql: (dbName: string, query: string, args?: any[]) => Promise<any>
}

export interface DbCommandPayload {
  action: 'getDatabases' | 'getTables' | 'executeSql'
  dbName?: string
  query?: string
  args?: any[]
}

