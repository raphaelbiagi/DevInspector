import { EventEmitter } from 'events'
import { WebSocketServer, WebSocket } from 'ws'
import { createServer, Server as HttpServer } from 'http'
import type { DevInspectorEvent, HttpRequestPayload } from './protocol'
import { AnomalyDetector } from './anomaly-detector'
import { RequestDiffer } from './request-differ'
import { SessionStore } from './session-store'

export interface ClientInfo {
  id: string
  platform: string
  appName: string
  connectedAt: number
}

export class DevToolsServer extends EventEmitter {
  private io: WebSocketServer | null = null
  private httpServer: HttpServer | null = null
  private port: number
  private connectedClient: WebSocket | null = null
  private pingIntervalId: ReturnType<typeof setInterval> | null = null

  // Novos serviços integrados
  private anomalyDetector: AnomalyDetector
  private requestDiffer: RequestDiffer
  private sessionStore: SessionStore

  // Mapa temporário de requests pendentes (aguardando response)
  private pendingRequests = new Map<string, HttpRequestPayload>()
  private pendingDbCommands = new Map<string, (response: any) => void>()

  constructor(port: number) {
    super()
    this.port = port

    this.anomalyDetector = new AnomalyDetector({
      onAnomaly: (anomaly) => {
        this.emit('devinspector:anomaly', anomaly)
      },
    })

    this.requestDiffer = new RequestDiffer()
    this.sessionStore = new SessionStore()
  }

  start(): void {
    this.httpServer = createServer((req, res) => {
      if (req.url === '/ping') {
        res.writeHead(200, {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'text/plain'
        })
        res.end('pong')
      } else if (req.url === '/upload-payload' && req.method === 'POST') {
        let body = ''
        req.on('data', chunk => {
          body += chunk.toString()
        })
        req.on('end', () => {
          try {
            const doParse = () => {
              try {
                const parsed = JSON.parse(body)
                this.handleClientEvent(parsed, 'http-bypass', () => {})
              } catch (e) {
                console.error('[DevInspector] Erro ao parsear payload gigante do POST', e)
              }
            }

            if (body.length > 1500000) {
              console.warn(`[DevInspector] Aviso: Payload POST muito grande (${(body.length / 1024 / 1024).toFixed(2)} MB). Decodificação adiada para não travar o event loop.`)
              setImmediate(doParse)
            } else {
              doParse()
            }

            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Content-Type': 'application/json'
            })
            res.end(JSON.stringify({ success: true }))
          } catch (e) {
            console.error('[DevInspector] Erro ao processar POST request', e)
            res.writeHead(400)
            res.end('Bad Request')
          }
        })
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    this.io = new WebSocketServer({
      server: this.httpServer,
      maxPayload: 50 * 1024 * 1024, // 50MB max message
    })

    this.pingIntervalId = setInterval(() => {
      this.io?.clients.forEach((ws) => {
        if ((ws as any).isAlive === false) return ws.terminate()
        ;(ws as any).isAlive = false
        ws.ping() // Isso é processado pelas threads Nativas no celular!
      })
    }, 30000)

    this.io.on('close', () => {
      if (this.pingIntervalId) clearInterval(this.pingIntervalId)
    })

    this.io.on('connection', (ws: WebSocket) => {
      const clientId = crypto.randomUUID()
      ;(ws as any).isAlive = true
      console.log(`[DevInspector] Client connected: ${clientId}`)
      this.connectedClient = ws

      ws.on('pong', () => {
        ;(ws as any).isAlive = true
      })

      const sendToClient = (event: string, payload?: any, ackId?: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ event, payload, ackId }))
        }
      }

      // MÁGICA: Pega o IPv4 real da máquina na rede Wi-Fi e envia para o celular!
      const { networkInterfaces } = require('os')
      const getLocalIPv4 = () => {
        const nets = networkInterfaces()
        const candidates: { address: string; score: number }[] = []

        for (const name of Object.keys(nets)) {
          const lowerName = name.toLowerCase()
          for (const net of nets[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
              let score = 0
              if (lowerName.indexOf('virtual') !== -1 || lowerName.indexOf('vmware') !== -1 || lowerName.indexOf('wsl') !== -1 || lowerName.indexOf('vethernet') !== -1 || lowerName.indexOf('pseudo') !== -1 || lowerName.indexOf('tailscale') !== -1) {
                score -= 100
              }
              if (net.address === '192.168.137.1') score -= 50
              if (lowerName.indexOf('wi-fi') !== -1 || lowerName.indexOf('wifi') !== -1 || lowerName.indexOf('wlan') !== -1) score += 50
              if (lowerName.indexOf('ethernet') !== -1 || lowerName === 'en0' || lowerName === 'eth0') score += 40
              if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.')) score += 10
              candidates.push({ address: net.address, score })
            }
          }
        }
        candidates.sort((a, b) => b.score - a.score)
        return candidates.length > 0 ? candidates[0].address : null
      }
      
      sendToClient('server:ipv4', getLocalIPv4())

      const sessionId = crypto.randomUUID()
      this.sessionStore.startSession(sessionId)

      ws.on('message', (dataRaw) => {
        try {
          const length = Buffer.isBuffer(dataRaw) ? dataRaw.length : 
                         (Array.isArray(dataRaw) ? Buffer.concat(dataRaw).length : (dataRaw as any).byteLength || 0)
          
          const doParse = () => {
            try {
              const parsed = JSON.parse(dataRaw.toString())
              this.handleClientEvent(parsed, clientId, (ackId) => {
                if (ackId) sendToClient('ack', null, ackId)
              })
            } catch (err) {
              console.error('[DevInspector] Invalid message received', err)
            }
          }

          if (length > 1500000) {
            console.warn(`[DevInspector] Aviso: Mensagem WS muito grande (${(length / 1024 / 1024).toFixed(2)} MB). Decodificação adiada para não travar o event loop.`)
            setImmediate(doParse)
          } else {
            doParse()
          }
        } catch (err) {
          console.error('[DevInspector] Error handling message', err)
        }
      })

      const handleDisconnect = (reason: string) => {
        console.log(`[DevInspector] Client disconnected: ${reason}`)
        if (this.connectedClient === ws) {
          this.connectedClient = null
        }
        this.sessionStore.endSession()
        this.pendingRequests.clear()
        this.emit('client-disconnected')
      }

      ws.on('close', () => handleDisconnect('socket closed'))
      ws.on('error', (err) => handleDisconnect(`socket error: ${err.message}`))
    })

    this.httpServer.listen(this.port, '0.0.0.0', () => {
      console.log(`[DevInspector] Server listening on 0.0.0.0:${this.port} (Native WebSockets)`)
      
      const { exec } = require('child_process')
      const setupAdbTunnel = () => {
        exec(`adb reverse tcp:${this.port} tcp:${this.port}`, (err: any) => {
          if (err) {
            if (process.platform === 'win32') {
              const localAppData = process.env.LOCALAPPDATA
              if (localAppData) {
                const adbPath = `${localAppData}\\Android\\Sdk\\platform-tools\\adb.exe`
                exec(`"${adbPath}" reverse tcp:${this.port} tcp:${this.port}`, () => {})
              }
            } else if (process.platform === 'darwin') {
              const macPath = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`
              exec(`"${macPath}" reverse tcp:${this.port} tcp:${this.port}`, () => {})
            }
          }
        })
      }
      
      setupAdbTunnel()
      setInterval(setupAdbTunnel, 10000)
    })
  }

  private handleClientEvent(parsed: any, clientId: string, ackCallback: (ackId?: string) => void): void {
    const { event, payload, ackId } = parsed

    if (event === 'devinspector:event') {
      const inspectorEvent = payload as DevInspectorEvent
      this.sessionStore.appendEvent(inspectorEvent)
      this.emit('devinspector:event', inspectorEvent)

      switch (inspectorEvent.type) {
        case 'session:handshake':
          this.sessionStore.setDeviceInfo(inspectorEvent.payload as unknown as Record<string, unknown>)
          this.emit('client-connected', {
            id: clientId,
            platform: inspectorEvent.payload.platform || 'unknown',
            appName: inspectorEvent.payload.appName || 'React Native App',
            connectedAt: Date.now()
          })
          break

        case 'http:request':
          this.pendingRequests.set(inspectorEvent.payload.id, inspectorEvent.payload)
          this.emit('network:request-start', {
            id: inspectorEvent.payload.id,
            method: inspectorEvent.payload.method,
            url: inspectorEvent.payload.url,
            requestHeaders: inspectorEvent.payload.headers,
            requestBody: inspectorEvent.payload.body,
            startTime: inspectorEvent.payload.timestamp,
            source: 'fetch'
          })
          break

        case 'http:response': {
          const request = this.pendingRequests.get(inspectorEvent.payload.requestId)
          if (request) {
            this.pendingRequests.delete(inspectorEvent.payload.requestId)
            this.anomalyDetector.analyzeResponse(request, inspectorEvent.payload)
            const diff = this.requestDiffer.record(request, inspectorEvent.payload)
            if (diff) this.emit('devinspector:diff', diff)
          }
          this.emit('network:request-end', {
            id: inspectorEvent.payload.requestId,
            statusCode: inspectorEvent.payload.statusCode,
            responseHeaders: inspectorEvent.payload.headers,
            responseBody: inspectorEvent.payload.body,
            responseSize: inspectorEvent.payload.size ?? null,
            endTime: inspectorEvent.payload.timestamp,
            duration: inspectorEvent.payload.duration
          })
          break
        }

        case 'console:entry':
          this.anomalyDetector.analyzeConsole(inspectorEvent.payload)
          this.emit('console:log', {
            id: inspectorEvent.payload.id,
            level: inspectorEvent.payload.level,
            args: Array.isArray(inspectorEvent.payload.args) ? inspectorEvent.payload.args : [],
            timestamp: inspectorEvent.payload.timestamp,
            stackTrace: inspectorEvent.payload.stackTrace ?? null
          })
          break
      }

      if (ackId) {
        ackCallback(ackId)
      }
    } else if (event === 'client:info') {
      this.emit('client-connected', {
        id: clientId,
        platform: payload.platform || 'unknown',
        appName: payload.appName || 'React Native App',
        connectedAt: Date.now()
      })
    } else if (event === 'network:request-start') {
      this.emit('network:request-start', payload)
    } else if (event === 'network:request-end') {
      this.emit('network:request-end', payload)
    } else if (event === 'network:request-error') {
      this.emit('network:request-error', payload)
    } else if (event === 'console:log') {
      this.emit('console:log', payload)
    } else if (event === 'server:db:response') {
       if (ackId) {
         const callback = this.pendingDbCommands.get(ackId)
         if (callback) callback(payload)
       }
    }
  }

  broadcastToClients(event: string, data: unknown): void {
    if (!this.io) return
    const msg = JSON.stringify({ event, payload: data })
    this.io.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg)
      }
    })
  }

  getSessionStore(): SessionStore {
    return this.sessionStore
  }

  async executeDbCommand(payload: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.connectedClient || this.connectedClient.readyState !== WebSocket.OPEN) {
        return reject(new Error('Nenhum dispositivo conectado'))
      }
      
      const ackId = crypto.randomUUID()
      const timer = setTimeout(() => {
        this.pendingDbCommands.delete(ackId)
        reject(new Error('Timeout aguardando resposta do banco de dados no dispositivo'))
      }, 30000)

      this.pendingDbCommands.set(ackId, (response: any) => {
        clearTimeout(timer)
        this.pendingDbCommands.delete(ackId)
        if (response && response.success) {
          resolve(response.data)
        } else {
          reject(new Error(response?.error || 'Erro desconhecido ao executar comando de banco de dados'))
        }
      })

      this.connectedClient.send(JSON.stringify({ event: 'server:db:execute', payload, ackId }))
    })
  }

  stop(): void {
    if (this.pingIntervalId) clearInterval(this.pingIntervalId)
    this.io?.close()
    this.httpServer?.close()
    this.io = null
    this.httpServer = null
    this.connectedClient = null
  }
}
