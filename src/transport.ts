import type { DevInspectorEvent, ConnectionStatus } from './types'

const MAX_BUFFER_SIZE = 500

interface TransportConfig {
  host?: string
  port?: number
  onStatusChange?: (status: ConnectionStatus) => void
  onToggleDebugger?: (visible: boolean) => void
  onClearLogs?: () => void
  onDbCommand?: (payload: any) => Promise<any>
}

export class DevInspectorTransport {
  private socket: WebSocket | null = null
  private eventQueue: DevInspectorEvent[] = []
  private isProcessingQueue = false
  private isPaused = false
  private status: ConnectionStatus = 'disconnected'
  private config: TransportConfig
  private listeners: Array<(status: ConnectionStatus) => void> = []
  private currentHost: string | null = null
  private currentPort: number = 8347
  private lifesaverIp: string | null = null

  // Lógica de Reconexão e Estabilidade
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private watchdogTimer: ReturnType<typeof setInterval> | null = null
  private offlineTime: number = 0
  private intentionallyClosed = false

  // Callbacks de ACK
  private pendingAcks = new Map<string, () => void>()

  constructor(config: TransportConfig) {
    this.config = config
  }

  connect(host: string, port: number): void {
    this.currentHost = host
    this.currentPort = port
    this.intentionallyClosed = false

    this.cleanup()

    const url = `ws://${host}:${port}`
    this.setStatus('retrying')

    try {
      // Inicializa o WebSocket Nativo (roda em background thread no Android/iOS)
      this.socket = new WebSocket(url)
    } catch (e) {
      this.scheduleReconnect()
      return
    }

    this.socket.onopen = () => {
      this.setStatus('connected')
      this.offlineTime = 0
      this.processQueue()
    }

    this.socket.onmessage = (e) => {
      try {
        const parsed = JSON.parse(e.data as string)
        const { event, payload, ackId } = parsed

        if (event === 'server:ipv4' && payload) {
          console.log(`[DevInspector] Bóia de Salvação guardada na memória: ${payload}`)
          this.lifesaverIp = payload
        } else if (event === 'server:clear-logs') {
          // O botão "Limpar" do desktop também esvazia o buffer local do app,
          // para que a UI In-App (bolha) não continue mostrando o que já foi limpo.
          this.eventQueue = []
          this.config.onClearLogs?.()
        } else if (event === 'server:toggle-debugger') {
          this.config.onToggleDebugger?.(payload.enabled)
        } else if (event === 'server:db:execute') {
          if (this.config.onDbCommand) {
            this.config.onDbCommand(payload).then(result => {
              this.sendRaw('server:db:response', { success: true, data: result }, ackId)
            }).catch(err => {
              this.sendRaw('server:db:response', { success: false, error: err?.message || String(err) }, ackId)
            })
          } else {
            this.sendRaw('server:db:response', { success: false, error: 'O app não configurou o onDbCommand.' }, ackId)
          }
        } else if (event === 'ack') {
          const cb = this.pendingAcks.get(ackId)
          if (cb) {
            this.pendingAcks.delete(ackId)
            cb()
          }
        }
      } catch (err) { }
    }

    this.socket.onclose = () => {
      if (!this.intentionallyClosed) {
        this.setStatus('retrying')
        this.scheduleReconnect()
      } else {
        this.setStatus('disconnected')
      }
    }

    this.socket.onerror = (e) => {
      // O evento onClose normalmente é disparado em seguida. Não reconectamos 2x.
    }

    // Watchdog agressivo: Força reinicialização do socket se ficar preso conectando
    this.watchdogTimer = setInterval(() => {
      if (this.status !== 'connected' && !this.isPaused && !this.intentionallyClosed) {
        this.offlineTime += 2000
        if (this.offlineTime >= 15000) {
          console.log('[DevInspector] Watchdog detectou socket travado. Forçando recriação completa!')
          this.offlineTime = 0
          this.connect(host, port)
        }
      } else {
        this.offlineTime = 0
      }
    }, 2000)
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.intentionallyClosed) return
    this.reconnectTimer = setTimeout(() => {
      if (this.currentHost && !this.intentionallyClosed) {
        this.connect(this.currentHost, this.config.port || 8347)
      }
    }, 3000)
  }

  private cleanup() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer)
      this.watchdogTimer = null
    }
    if (this.socket) {
      this.socket.onclose = null
      this.socket.onerror = null
      this.socket.onmessage = null
      this.socket.onopen = null
      this.socket.close()
      this.socket = null
    }
  }

  // Helper interno para enviar mensagens no formato padronizado do WebSocketServer
  private sendRaw(event: string, payload: any, ackId?: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ event, payload, ackId }))
    }
  }

  send(event: DevInspectorEvent): void {
    if (this.eventQueue.length < MAX_BUFFER_SIZE) {
      this.eventQueue.push(event)
    }
    this.processQueue()
  }

  /**
   * Envia mensagem legada
   */
  sendLegacy(event: string, payload: unknown): void {
    this.sendRaw(event, payload)
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  destroy(): void {
    this.disconnect()
    this.listeners = []
  }

  getCurrentPort(): number {
    return this.currentPort
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  getBufferSize(): number {
    return this.eventQueue.length
  }

  getCurrentHost(): string | null {
    return this.currentHost
  }

  getLifesaverIp(): string | null {
    return this.lifesaverIp
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN
  }

  disconnect(): void {
    this.intentionallyClosed = true
    this.cleanup()
    this.eventQueue = []
    this.pendingAcks.clear()
    this.setStatus('disconnected')
  }

  setPaused(paused: boolean): void {
    this.isPaused = paused
    if (!paused && this.isConnected()) {
      this.processQueue()
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || !this.isConnected() || this.eventQueue.length === 0 || this.isPaused) {
      return
    }

    this.isProcessingQueue = true

    try {
      while (this.eventQueue.length > 0 && this.isConnected()) {
        const event = this.eventQueue[0]

        // Identificador para emular o sistema de ACK que tínhamos no Socket.IO
        const ackId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7)

        // Aguarda a confirmação (ACK) do servidor
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => {
            this.pendingAcks.delete(ackId)
            reject(new Error('ACK Timeout'))
          }, 5000)

          this.pendingAcks.set(ackId, () => {
            clearTimeout(timer)
            resolve()
          })

          this.sendRaw('devinspector:event', event, ackId)
        })

        // Se chegou aqui, o servidor confirmou o recebimento. Removemos da fila.
        this.eventQueue.shift()

        // Yielding: Dar respiro à thread JS para não bloquear o aplicativo e permitir animações
        await new Promise(r => setTimeout(r, 10))
      }
    } catch (error) {
      // Falha ao receber o ACK (timeout ou desconexão).
      // O loop é interrompido. Os eventos não confirmados permanecem na fila.
    } finally {
      this.isProcessingQueue = false

      // Tenta retomar se ainda houver eventos (ex: erro de timeout na rede instável)
      if (this.eventQueue.length > 0 && this.isConnected() && !this.isPaused) {
        setTimeout(() => this.processQueue(), 1000)
      }
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return
    this.status = status
    this.config.onStatusChange?.(status)
    this.listeners.forEach(l => l(status))
  }
}

// Singleton para uso no SDK
let _transport: DevInspectorTransport | null = null

export function getTransport(): DevInspectorTransport {
  if (!_transport) throw new Error('[DevInspector] Transport não inicializado. Chame DevInspector.init() primeiro.')
  return _transport
}

export function initTransport(config: TransportConfig): DevInspectorTransport {
  if (_transport) {
    _transport.disconnect()
  }
  _transport = new DevInspectorTransport(config)
  return _transport
}

export function hasTransport(): boolean {
  return _transport !== null
}
