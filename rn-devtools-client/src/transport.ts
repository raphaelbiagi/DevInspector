import { io, Socket } from 'socket.io-client'
import type { DevInspectorEvent, ConnectionStatus } from './types'

const MAX_BUFFER_SIZE = 500

interface TransportConfig {
  host?: string
  port?: number
  onStatusChange?: (status: ConnectionStatus) => void
  onToggleDebugger?: (visible: boolean) => void
  onDbCommand?: (payload: any) => Promise<any>
}

export class DevInspectorTransport {
  private socket: Socket | null = null
  private buffer: DevInspectorEvent[] = []
  private status: ConnectionStatus = 'disconnected'
  private config: TransportConfig
  private listeners: Array<(status: ConnectionStatus) => void> = []
  private currentHost: string | null = null
  private lifesaverIp: string | null = null

  constructor(config: TransportConfig) {
    this.config = config
  }

  connect(host: string, port: number): void {
    this.currentHost = host

    // Desconecta socket anterior se existir
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    const url = `http://${host}:${port}`

    this.socket = io(url, {
      forceNew: true, // Crucial para o React Strict Mode não reaproveitar socket morto
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 60000, // Aumentado para evitar timeout na conexão se a thread estiver ocupada
      transports: ['websocket'],
    })

    this.socket.on('connect', () => {
      this.setStatus('connected')
      this.flushBuffer()
    })

    // Recebe o IPv4 do Desktop e salva na memória IMEDIATAMENTE (sem depender de AsyncStorage)
    this.socket.on('server:ipv4', (ip: string) => {
      if (ip) {
        console.log(`[DevInspector] Bóia de Salvação guardada na memória: ${ip}`)
        this.lifesaverIp = ip
      }
    })

    this.socket.on('disconnect', () => {
      this.setStatus('disconnected')
    })

    this.socket.io.on('reconnect_attempt', () => {
      this.setStatus('retrying')
    })

    this.socket.on('connect_error', () => {
      if (this.status !== 'retrying') {
        this.setStatus('retrying')
      }
    })

    this.socket.on('server:clear-logs', () => {
      // Placeholder para limpeza local futura
    })

    this.socket.on('server:toggle-debugger', (data: { enabled: boolean }) => {
      this.config.onToggleDebugger?.(data.enabled)
    })

    this.socket.on('server:db:execute', async (payload: any, callback: (response: any) => void) => {
      if (this.config.onDbCommand) {
        try {
          const result = await this.config.onDbCommand(payload)
          callback({ success: true, data: result })
        } catch (err: any) {
          callback({ success: false, error: err?.message || String(err) })
        }
      } else {
        callback({ success: false, error: 'O app não configurou o onDbCommand.' })
      }
    })
  }

  send(event: DevInspectorEvent): void {
    if (this.socket?.connected) {
      this.socket.emit('devinspector:event', event)
    } else {
      if (this.buffer.length < MAX_BUFFER_SIZE) {
        this.buffer.push(event)
      }
      // Silently drop when buffer is full — evita leak de memória
    }
  }

  /**
   * Envia mensagem legada (formato antigo: tipo como canal, payload como dados)
   */
  sendLegacy(type: string, payload: unknown): void {
    if (this.socket?.connected) {
      this.socket.emit(type, payload)
    }
  }

  onStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  getBufferSize(): number {
    return this.buffer.length
  }

  getCurrentHost(): string | null {
    return this.currentHost
  }

  getLifesaverIp(): string | null {
    return this.lifesaverIp
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false
  }

  disconnect(): void {
    this.socket?.disconnect()
    this.socket = null
    this.buffer = []
    this.setStatus('disconnected')
  }

  private flushBuffer(): void {
    const toFlush = [...this.buffer]
    this.buffer = []
    toFlush.forEach(event => this.socket?.emit('devinspector:event', event))
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
