import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

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
  executeDbCommand: (payload: any) => Promise<any>
}

function createListener(channel: string, callback: (...args: any[]) => void): () => void {
  const handler = (_event: IpcRendererEvent, ...args: any[]): void => {
    callback(...args)
  }
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const api: DevInspectorAPI = {
  getServerPort: () => ipcRenderer.invoke('get-server-port'),
  clearClientLogs: () => ipcRenderer.invoke('clear-client-logs'),
  exportSaveDialog: (defaultName: string) => ipcRenderer.invoke('export-save-dialog', defaultName),
  writeExportFile: (filePath: string, content: string) => ipcRenderer.invoke('write-export-file', filePath, content),
  onNetworkRequestStart: (cb) => createListener('network:request-start', cb),
  onNetworkRequestEnd: (cb) => createListener('network:request-end', cb),
  onNetworkRequestError: (cb) => createListener('network:request-error', cb),
  onConsoleLog: (cb) => createListener('console:log', cb),
  onConnectionStatus: (cb) => createListener('connection:status', cb),
  // Novos
  onDevinspectorEvent: (cb) => createListener('devinspector:event', cb),
  onDevinspectorAnomaly: (cb) => createListener('devinspector:anomaly', cb),
  onDevinspectorDiff: (cb) => createListener('devinspector:diff', cb),
  listSessions: () => ipcRenderer.invoke('list-sessions'),
  loadSession: (sessionId: string) => ipcRenderer.invoke('load-session', sessionId),
  toggleFloatingDebugger: (enabled: boolean) => ipcRenderer.invoke('toggle-floating-debugger', enabled),
  executeDbCommand: (payload: any) => ipcRenderer.invoke('execute-db-command', payload),
}

contextBridge.exposeInMainWorld('devInspector', api)
