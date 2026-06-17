export interface DevInspectorAPI {
  getServerPort: () => Promise<number>
  clearClientLogs: () => Promise<void>
  exportSaveDialog: (defaultName: string) => Promise<string | null>
  writeExportFile: (filePath: string, content: string) => Promise<void>
  onNetworkRequestStart: (callback: (data: any) => void) => () => void
  onNetworkRequestEnd: (callback: (data: any) => void) => () => void
  onNetworkRequestError: (callback: (data: any) => void) => () => void
  onConsoleLog: (callback: (data: any) => void) => () => void
  onConnectionStatus: (callback: (data: any) => void) => () => void
  // Novos listeners do protocolo unificado
  onDevinspectorEvent: (callback: (data: any) => void) => () => void
  onDevinspectorAnomaly: (callback: (data: any) => void) => () => void
  onDevinspectorDiff: (callback: (data: any) => void) => () => void
  // Gerenciamento de sessão
  listSessions: () => Promise<any[]>
  loadSession: (sessionId: string) => Promise<any | null>
  toggleFloatingDebugger: (enabled: boolean) => Promise<void>
}

declare global {
  interface Window {
    devInspector: DevInspectorAPI
  }
}

export interface ClientInfo {
  id: string
  platform: string
  appName: string
  connectedAt: number
}

export interface ConnectionStatusPayload {
  connected: boolean
  clientInfo: ClientInfo | null
}

// Tipos para anomalias recebidas no renderer
export interface AnomalyPayload {
  id: string
  type: 'slow_request' | 'large_response' | 'error_status' | 'console_flood' | 'repeated_error'
  severity: 'warning' | 'critical'
  relatedId: string
  description: string
  timestamp: number
}

// Tipos para diffs recebidos no renderer
export interface RequestDiffPayload {
  requestId: string
  previousRequestId: string
  bodyDiff: Array<{ type: 'added' | 'removed' | 'unchanged'; key?: string; value: string; line: number }>
  headersDiff: Array<{ type: 'added' | 'removed' | 'unchanged'; key?: string; value: string; line: number }>
  statusChanged: boolean
  previousStatus?: number
  durationDelta?: number
}
