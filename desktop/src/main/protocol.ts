// ============================================================
// DevInspector Protocol — Contrato compartilhado SDK <-> Desktop
// ============================================================

export const PROTOCOL_VERSION = '1.0.0'

// --- Tipos base ---

export type LogLevel = 'log' | 'warn' | 'error' | 'info' | 'debug'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

export type ConnectionStatus = 'discovering' | 'connected' | 'disconnected' | 'retrying'

// --- Payload: Handshake ---
// Enviado pelo SDK ao conectar. Permite o desktop identificar o dispositivo.

export interface HandshakePayload {
  sdkVersion: string
  appName: string
  appVersion: string
  platform: 'ios' | 'android' | 'web' | 'unknown'
  osVersion: string
  deviceName: string
  reactNativeVersion: string
  sessionId: string       // UUID gerado no momento da conexão
  connectedAt: number     // timestamp ms
}

// --- Payload: Console ---

export interface ConsolePayload {
  id: string              // UUID
  level: LogLevel
  args: unknown[]         // Argumentos originais do console.*
  message: string         // Versão stringificada para busca
  timestamp: number
  stackTrace?: string
  sessionId: string
}

// --- Payload: HTTP Request ---

export interface HttpRequestPayload {
  id: string              // UUID — correlaciona request com response
  method: HttpMethod
  url: string
  headers: Record<string, string>
  body?: string
  timestamp: number
  sessionId: string
}

// --- Payload: HTTP Response ---

export interface HttpResponsePayload {
  requestId: string       // Mesmo ID da request correspondente
  statusCode: number
  statusText: string
  headers: Record<string, string>
  body?: string
  duration: number        // ms entre request e response
  size?: number           // bytes
  timestamp: number
  sessionId: string
}

// --- Payload: Anomalia detectada ---
// Gerado pelo desktop ao identificar padrões suspeitos

export interface AnomalyPayload {
  id: string
  type:
    | 'slow_request'        // request > threshold de tempo
    | 'large_response'      // response > threshold de tamanho
    | 'error_status'        // status 4xx/5xx
    | 'console_flood'       // mesmo log repetido N vezes em X segundos
    | 'repeated_error'      // mesmo console.error repetido
  severity: 'warning' | 'critical'
  relatedId: string         // ID da request ou log que gerou a anomalia
  description: string
  timestamp: number
}

// --- Union de todos os eventos ---

export type DevInspectorEvent =
  | { type: 'session:handshake';   payload: HandshakePayload }
  | { type: 'console:entry';       payload: ConsolePayload }
  | { type: 'http:request';        payload: HttpRequestPayload }
  | { type: 'http:response';       payload: HttpResponsePayload }
  | { type: 'anomaly:detected';    payload: AnomalyPayload }

// --- Helpers de type guard ---

export function isConsoleEvent(e: DevInspectorEvent): e is { type: 'console:entry'; payload: ConsolePayload } {
  return e.type === 'console:entry'
}

export function isHttpRequestEvent(e: DevInspectorEvent): e is { type: 'http:request'; payload: HttpRequestPayload } {
  return e.type === 'http:request'
}

export function isHttpResponseEvent(e: DevInspectorEvent): e is { type: 'http:response'; payload: HttpResponsePayload } {
  return e.type === 'http:response'
}

export function isAnomalyEvent(e: DevInspectorEvent): e is { type: 'anomaly:detected'; payload: AnomalyPayload } {
  return e.type === 'anomaly:detected'
}

export function isHandshakeEvent(e: DevInspectorEvent): e is { type: 'session:handshake'; payload: HandshakePayload } {
  return e.type === 'session:handshake'
}
