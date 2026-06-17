import { initTransport, getTransport, hasTransport, DevInspectorTransport } from './transport'
import { discoverDesktop, getFallbackHost } from './discovery'
import type { ClientMessage, ConnectionStatus, DevInspectorEvent } from './types'

const DEFAULT_PORT = 8347

interface InitOptions {
  host?: string
  port?: number
  enabled?: boolean
}

export class DevToolsClient {
  private transport: DevInspectorTransport | null = null
  private isInitialized = false
  private initCounter = 0
  
  // Histórico in-memory para a UI do celular
  private history: DevInspectorEvent[] = []
  private historyListeners: Array<() => void> = []

  // Visibilidade do bolha flutuante
  private isVisible = true
  private visibilityListeners: Array<(visible: boolean) => void> = []

  constructor() {}

  async init(options: InitOptions = {}): Promise<void> {
    const { host, port = DEFAULT_PORT, enabled = true } = options

    if (!enabled || this.isInitialized) return
    this.isInitialized = true
    const currentInitId = ++this.initCounter

    // A Mágica: Se não tem host, pega direto do Metro Bundler!
    const targetHost = host || getFallbackHost()

    console.log(`[DevInspector] Iniciando cliente. Alvo: ${targetHost}:${port}`)

    this.transport = initTransport({
      host: targetHost,
      port,
      onStatusChange: (status) => {
        console.log(`[DevInspector] Status da conexão mudou para: ${status}`)
        
        if (status === 'connected' && this.transport) {
          console.log('[DevInspector] Conectado! Enviando handshake...')
          this.transport.send({
            type: 'session:handshake',
            payload: {
              sdkVersion: '1.0.0',
              appName: 'React Native App',
              platform: 'native'
            } as Record<string, unknown>
          })
        }

        // Bóia de salvação ativa: se cair a conexão (ex: cabo puxado), e a gente não amarrou um host fixo:
        if ((status === 'disconnected' || status === 'retrying') && !host) {
          setTimeout(async () => {
            if (this.initCounter !== currentInitId) return // Componente reiniciou
            if (this.transport?.getStatus() !== 'connected') {
              const lifesaver = this.transport?.getLifesaverIp()
              const currentTrying = this.transport?.getCurrentHost()
              // Se tivermos a bóia na memória, e não estivermos já tentando usar ela
              if (lifesaver && lifesaver !== currentTrying) {
                console.log(`[DevInspector] Conexão falhou no ${currentTrying}. Ativando Bóia de Salvação (Wi-Fi): ${lifesaver}`)
                this.transport?.connect(lifesaver, port)
              }
            }
          }, 3500)
        }
      },
      onToggleDebugger: (visible) => {
        console.log(`[DevInspector] Desktop solicitou UI In-App visível: ${visible}`)
        this.setVisibility(visible)
      }
    })

    console.log(`[DevInspector] Disparando socket.connect() para ${targetHost}`)
    this.transport.connect(targetHost, port)
  }

  send(message: ClientMessage): void {
    if (!this.isInitialized) return
    
    const converted = this.convertToEvent(message)
    if (!converted) return

    // Salva no histórico local para a UI flutuante usando o EVENTO CONVERTIDO
    this.history.unshift(converted)
    if (this.history.length > 100) {
      this.history.pop() // Limita a 100 eventos para não pesar a RAM
    }
    this.notifyHistoryListeners()

    if (this.transport && this.transport.isConnected()) {
      this.transport.send(converted)
    }
  }

  sendEvent(event: DevInspectorEvent): void {
    if (!this.transport) return
    this.transport.send(event)
  }

  disconnect(): void {
    console.log('[DevInspector] Disconnect solicitado pelo React/App')
    this.transport?.disconnect()
    this.transport = null
    this.isInitialized = false
  }

  destroy(): void {
    if (this.transport) {
      this.transport.disconnect()
      this.transport = null
    }
    this.isInitialized = false
    this.history = []
    this.historyListeners = []
  }

  // --- Métodos do Histórico In-App ---
  
  getHistory(): DevInspectorEvent[] {
    return this.history
  }

  subscribeHistory(listener: () => void): () => void {
    this.historyListeners.push(listener)
    return () => {
      this.historyListeners = this.historyListeners.filter(l => l !== listener)
    }
  }

  private notifyHistoryListeners() {
    this.historyListeners.forEach(listener => listener())
  }

  // --- Visibilidade do UI In-App ---

  getIsVisible(): boolean {
    return this.isVisible
  }

  setVisibility(visible: boolean) {
    if (this.isVisible === visible) return
    this.isVisible = visible
    this.visibilityListeners.forEach(l => l(visible))
  }

  subscribeVisibility(listener: (visible: boolean) => void): () => void {
    this.visibilityListeners.push(listener)
    return () => {
      this.visibilityListeners = this.visibilityListeners.filter(l => l !== listener)
    }
  }

  getStatus(): ConnectionStatus {
    return this.transport?.getStatus() ?? 'disconnected'
  }

  getBufferSize(): number {
    return this.transport?.getBufferSize() ?? 0
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    if (!this.transport) return () => {}
    return this.transport.onStatusChange(listener)
  }

  getTransport(): DevInspectorTransport | null {
    return this.transport
  }

  private convertToEvent(message: ClientMessage): DevInspectorEvent | null {
    switch (message.type) {
      case 'client:info':
        return {
          type: 'session:handshake',
          payload: {
            sdkVersion: '1.0.0',
            appName: message.payload.appName,
            platform: message.payload.platform,
          } as Record<string, unknown>,
        }
      case 'console:log':
        return {
          type: 'console:entry',
          payload: {
            id: message.payload.id,
            level: message.payload.level,
            args: message.payload.args,
            message: message.payload.args
              .map(a => typeof a.value === 'string' ? a.value : JSON.stringify(a.value))
              .join(' '),
            timestamp: message.payload.timestamp,
            stackTrace: message.payload.stackTrace,
            sessionId: '',
          } as Record<string, unknown>,
        }
      case 'network:request-start':
        return {
          type: 'http:request',
          payload: {
            id: message.payload.id,
            method: message.payload.method,
            url: message.payload.url,
            headers: message.payload.requestHeaders,
            body: typeof message.payload.requestBody === 'string'
              ? message.payload.requestBody
              : JSON.stringify(message.payload.requestBody),
            timestamp: message.payload.startTime,
            sessionId: '',
          } as Record<string, unknown>,
        }
      case 'network:request-end':
        return {
          type: 'http:response',
          payload: {
            requestId: message.payload.id,
            statusCode: message.payload.statusCode,
            statusText: '',
            headers: message.payload.responseHeaders,
            body: typeof message.payload.responseBody === 'string'
              ? message.payload.responseBody
              : JSON.stringify(message.payload.responseBody),
            duration: message.payload.duration,
            size: message.payload.responseSize,
            timestamp: message.payload.endTime,
            sessionId: '',
          } as Record<string, unknown>,
        }
      case 'network:request-error':
        return {
          type: 'http:response',
          payload: {
            requestId: message.payload.id,
            statusCode: 0,
            statusText: message.payload.error,
            headers: {},
            duration: message.payload.duration,
            timestamp: message.payload.endTime,
            sessionId: '',
          } as Record<string, unknown>,
        }
      default:
        return null
    }
  }
}

export const devToolsClient = new DevToolsClient()
