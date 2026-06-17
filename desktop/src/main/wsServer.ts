import { EventEmitter } from 'events'
import { Server as SocketIOServer, Socket } from 'socket.io'
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
  private io: SocketIOServer | null = null
  private httpServer: HttpServer | null = null
  private port: number
  private connectedClient: Socket | null = null

  // Novos serviços integrados
  private anomalyDetector: AnomalyDetector
  private requestDiffer: RequestDiffer
  private sessionStore: SessionStore

  // Mapa temporário de requests pendentes (aguardando response)
  private pendingRequests = new Map<string, HttpRequestPayload>()

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
    this.httpServer = createServer()

    this.io = new SocketIOServer(this.httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      maxHttpBufferSize: 50 * 1024 * 1024, // 50MB max message (Aumentado para suportar requisições enormes)
      pingTimeout: 60000, // 60s (Tolerar bloqueio da main thread durante o salvamento em lote)
      pingInterval: 25000 // 25s (Acompanhando o pingTimeout)
    })

    this.io.on('connection', (socket: Socket) => {
      console.log(`[DevInspector] Client connected: ${socket.id}`)
      this.connectedClient = socket

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

              // Penalidades (Ignorar interfaces virtuais e hotspots)
              if (lowerName.includes('virtual') || lowerName.includes('vmware') || lowerName.includes('wsl') || lowerName.includes('vethernet') || lowerName.includes('pseudo') || lowerName.includes('tailscale')) {
                score -= 100
              }
              if (net.address === '192.168.137.1') {
                 score -= 50 // IP padrão do Windows Mobile Hotspot / ICS
              }

              // Bônus (Priorizar redes locais reais)
              if (lowerName.includes('wi-fi') || lowerName.includes('wifi') || lowerName.includes('wlan')) {
                score += 50
              }
              if (lowerName.includes('ethernet') || lowerName === 'en0' || lowerName === 'eth0') {
                score += 40
              }
              if (net.address.startsWith('192.168.') || net.address.startsWith('10.') || net.address.startsWith('172.')) {
                score += 10
              }

              candidates.push({ address: net.address, score })
            }
          }
        }

        // Ordena do maior score pro menor e pega o melhor
        candidates.sort((a, b) => b.score - a.score)
        return candidates.length > 0 ? candidates[0].address : null
      }
      socket.emit('server:ipv4', getLocalIPv4())

      const sessionId = crypto.randomUUID()
      this.sessionStore.startSession(sessionId)

      // ====================================================
      // Novo canal unificado: devinspector:event
      // ====================================================
      socket.on('devinspector:event', (event: DevInspectorEvent) => {
        // Persiste o evento
        this.sessionStore.appendEvent(event)

        // Encaminha para o renderer
        this.emit('devinspector:event', event)

        // Processamento específico por tipo
        switch (event.type) {
          case 'session:handshake':
            this.sessionStore.setDeviceInfo(event.payload as unknown as Record<string, unknown>)
            {
              const info: ClientInfo = {
                id: socket.id,
                platform: event.payload.platform || 'unknown',
                appName: event.payload.appName || 'React Native App',
                connectedAt: Date.now()
              }
              this.emit('client-connected', info)
            }
            break

          case 'http:request':
            this.pendingRequests.set(event.payload.id, event.payload)
            // Compatibilidade: emite evento legado
            this.emit('network:request-start', {
              id: event.payload.id,
              method: event.payload.method,
              url: event.payload.url,
              requestHeaders: event.payload.headers,
              requestBody: event.payload.body,
              startTime: event.payload.timestamp,
              source: 'fetch'
            })
            break

          case 'http:response': {
            const request = this.pendingRequests.get(event.payload.requestId)
            if (request) {
              this.pendingRequests.delete(event.payload.requestId)
              this.anomalyDetector.analyzeResponse(request, event.payload)
              const diff = this.requestDiffer.record(request, event.payload)
              if (diff) {
                this.emit('devinspector:diff', diff)
              }
            }
            // Compatibilidade: emite evento legado
            this.emit('network:request-end', {
              id: event.payload.requestId,
              statusCode: event.payload.statusCode,
              responseHeaders: event.payload.headers,
              responseBody: event.payload.body,
              responseSize: event.payload.size ?? null,
              endTime: event.payload.timestamp,
              duration: event.payload.duration
            })
            break
          }

          case 'console:entry':
            this.anomalyDetector.analyzeConsole(event.payload)
            // Compatibilidade: emite evento legado
            this.emit('console:log', {
              id: event.payload.id,
              level: event.payload.level,
              args: Array.isArray(event.payload.args)
                ? event.payload.args.map(a => ({ type: typeof a, value: a }))
                : [],
              timestamp: event.payload.timestamp,
              stackTrace: event.payload.stackTrace ?? null
            })
            break
        }
      })

      // ====================================================
      // Canais legados (compatibilidade com SDK atual)
      // ====================================================
      socket.on('client:info', (data: Omit<ClientInfo, 'id' | 'connectedAt'>) => {
        const info: ClientInfo = {
          id: socket.id,
          platform: data.platform || 'unknown',
          appName: data.appName || 'React Native App',
          connectedAt: Date.now()
        }
        this.emit('client-connected', info)
      })

      socket.on('network:request-start', (data: unknown) => {
        this.emit('network:request-start', data)
      })

      socket.on('network:request-end', (data: unknown) => {
        this.emit('network:request-end', data)
      })

      socket.on('network:request-error', (data: unknown) => {
        this.emit('network:request-error', data)
      })

      socket.on('console:log', (data: unknown) => {
        this.emit('console:log', data)
      })

      socket.on('disconnect', (reason: string) => {
        console.log(`[DevInspector] Client disconnected: ${reason}`)
        if (this.connectedClient?.id === socket.id) {
          this.connectedClient = null
        }
        this.sessionStore.endSession()
        this.pendingRequests.clear()
        this.emit('client-disconnected')
      })
    })

    this.httpServer.listen(this.port, '0.0.0.0', () => {
      console.log(`[DevInspector] Server listening on 0.0.0.0:${this.port}`)
      
      // MÁGICA DE AUTOMAÇÃO USB (ADB REVERSE)
      // Garante que qualquer celular Android conectado via USB tenha a porta mapeada automaticamente
      const { exec } = require('child_process')
      const setupAdbTunnel = () => {
        // Tenta rodar o comando adb globalmente
        exec(`adb reverse tcp:${this.port} tcp:${this.port}`, (err: any) => {
          if (err) {
            // Fallback para Windows (caminho padrão do Android SDK)
            if (process.platform === 'win32') {
              const localAppData = process.env.LOCALAPPDATA
              if (localAppData) {
                const adbPath = `${localAppData}\\Android\\Sdk\\platform-tools\\adb.exe`
                exec(`"${adbPath}" reverse tcp:${this.port} tcp:${this.port}`, (fallbackErr: any) => {
                  // Silencioso
                })
              }
            } else if (process.platform === 'darwin') {
              const macPath = `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`
              exec(`"${macPath}" reverse tcp:${this.port} tcp:${this.port}`, () => {})
            }
          }
        })
      }
      
      // Roda imediatamente e depois a cada 10 segundos
      setupAdbTunnel()
      setInterval(setupAdbTunnel, 10000)
    })
  }

  broadcastToClients(event: string, data: unknown): void {
    this.io?.emit(event, data)
  }

  getSessionStore(): SessionStore {
    return this.sessionStore
  }

  stop(): void {
    this.io?.close()
    this.httpServer?.close()
    this.io = null
    this.httpServer = null
    this.connectedClient = null
  }
}
