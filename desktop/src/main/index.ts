import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { DevToolsServer } from './wsServer'
import { DiscoveryServer } from './discovery-server'

const DEFAULT_PORT = 8347

let mainWindow: BrowserWindow | null = null
let devToolsServer: DevToolsServer | null = null
let discoveryServer: DiscoveryServer | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0e0e0e',
    title: 'DevInspector',
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function startServer(): void {
  devToolsServer = new DevToolsServer(DEFAULT_PORT)

  devToolsServer.on('client-connected', (info) => {
    mainWindow?.webContents.send('connection:status', { connected: true, clientInfo: info })
  })

  devToolsServer.on('client-disconnected', () => {
    mainWindow?.webContents.send('connection:status', { connected: false, clientInfo: null })
  })

  devToolsServer.on('network:request-start', (data) => {
    mainWindow?.webContents.send('network:request-start', data)
  })

  devToolsServer.on('network:request-end', (data) => {
    mainWindow?.webContents.send('network:request-end', data)
  })

  devToolsServer.on('network:request-error', (data) => {
    mainWindow?.webContents.send('network:request-error', data)
  })

  devToolsServer.on('console:log', (data) => {
    mainWindow?.webContents.send('console:log', data)
  })

  // Novos eventos do protocolo unificado
  devToolsServer.on('devinspector:event', (event) => {
    if (event.type === 'db:chunk') {
      mainWindow?.webContents.send('db-chunk', event.payload)
    }
    mainWindow?.webContents.send('devinspector:event', event)
  })

  devToolsServer.on('devinspector:anomaly', (anomaly) => {
    mainWindow?.webContents.send('devinspector:anomaly', anomaly)
  })

  devToolsServer.on('devinspector:diff', (diff) => {
    mainWindow?.webContents.send('devinspector:diff', diff)
  })

  devToolsServer.start()
  console.log(`[DevInspector] WebSocket server listening on port ${DEFAULT_PORT}`)

  // Iniciar servidor de discovery (auto-detecção zero-config)
  discoveryServer = new DiscoveryServer(DEFAULT_PORT)
  discoveryServer.start()
}

function setupIPC(): void {
  ipcMain.handle('get-server-port', () => DEFAULT_PORT)

  ipcMain.handle('clear-client-logs', () => {
    devToolsServer?.broadcastToClients('server:clear-logs', {})
  })

  ipcMain.handle('toggle-floating-debugger', (_event, enabled: boolean) => {
    devToolsServer?.broadcastToClients('server:toggle-debugger', { enabled })
  })

  ipcMain.handle('export-save-dialog', async (_event, defaultName: string) => {
    if (!mainWindow) return null
    const { dialog } = await import('electron')
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    return result.filePath ?? null
  })

  ipcMain.handle('write-export-file', async (_event, filePath: string, content: string) => {
    const { writeFile } = await import('fs/promises')
    await writeFile(filePath, content, 'utf-8')
  })

  // Novos IPC handlers para gerenciamento de sessão
  ipcMain.handle('list-sessions', () => {
    return devToolsServer?.getSessionStore().listSessions() ?? []
  })

  ipcMain.handle('load-session', async (_event, sessionId: string) => {
    return (await devToolsServer?.getSessionStore().loadSession(sessionId)) ?? null
  })

  ipcMain.handle('execute-db-command', async (_event, payload: any) => {
    if (!devToolsServer) throw new Error('Servidor não inicializado')
    return await devToolsServer.executeDbCommand(payload)
  })
}

app.whenReady().then(() => {
  setupIPC()
  startServer()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  devToolsServer?.stop()
  discoveryServer?.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})