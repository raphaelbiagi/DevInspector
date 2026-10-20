import { contextBridge, ipcRenderer, IpcRendererEvent, webUtils } from 'electron'

export interface DevInspectorAPI {
  getServerPort: () => Promise<number>
  writeClipboard: (text: string) => Promise<void>
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
  onDbChunk: (callback: (data: any) => void) => () => void
  // Gerenciamento de bancos locais SQLite
  openDbFileDialog: () => Promise<any | null>
  importLocalDb: (filePath: string) => Promise<any>
  removeLocalDb: (id: string) => Promise<boolean>
  listLocalDbs: () => Promise<any[]>
  getPathForFile: (file: File) => string
  // Logcat
  logcatListDevices: () => Promise<{ devices: any[]; error: string | null }>
  logcatListPackages: (serial: string) => Promise<string[]>
  logcatStart: (options: { serial: string; packageName?: string | null }) => Promise<any>
  logcatStop: () => Promise<any>
  logcatGetStatus: () => Promise<any>
  onLogcatEntries: (callback: (data: any[]) => void) => () => void
  onLogcatStatus: (callback: (data: any) => void) => () => void
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
  writeClipboard: (text: string) => ipcRenderer.invoke('write-clipboard', text),
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
  onDbChunk: (cb) => createListener('db-chunk', cb),
  // Bancos locais
  openDbFileDialog: () => ipcRenderer.invoke('open-db-file-dialog'),
  importLocalDb: (filePath: string) => ipcRenderer.invoke('import-local-db', filePath),
  removeLocalDb: (id: string) => ipcRenderer.invoke('remove-local-db', id),
  listLocalDbs: () => ipcRenderer.invoke('list-local-dbs'),
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file)
    } catch {
      return (file as any).path || ''
    }
  },
  // Logcat
  logcatListDevices: () => ipcRenderer.invoke('logcat-list-devices'),
  logcatListPackages: (serial: string) => ipcRenderer.invoke('logcat-list-packages', serial),
  logcatStart: (options) => ipcRenderer.invoke('logcat-start', options),
  logcatStop: () => ipcRenderer.invoke('logcat-stop'),
  logcatGetStatus: () => ipcRenderer.invoke('logcat-get-status'),
  onLogcatEntries: (cb) => createListener('logcat:entries', cb),
  onLogcatStatus: (cb) => createListener('logcat:status', cb)
}

contextBridge.exposeInMainWorld('devInspector', api)
