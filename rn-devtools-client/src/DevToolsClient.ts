import { initTransport, getTransport, hasTransport, DevInspectorTransport } from './transport'
import { discoverDesktop, getFallbackHost } from './discovery'
import type { ClientMessage, ConnectionStatus, DevInspectorEvent, DatabaseDriver, DbCommandPayload } from './types'

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
  private isVisible = false
  private visibilityListeners: Array<(visible: boolean) => void> = []
  private notifyTimeout: ReturnType<typeof setTimeout> | null = null

  // Driver de Banco de Dados
  private dbDriver: DatabaseDriver | null = null

  constructor() {}

  async init(options: InitOptions = {}): Promise<void> {
    const { host, port = DEFAULT_PORT, enabled = true } = options

    if (!enabled || this.isInitialized) return
    this.isInitialized = true
    const currentInitId = ++this.initCounter

    // A Mágica: Tenta descobrir qual IP está escutando o DevInspector na rede
    let targetHost = host
    if (!targetHost) {
      console.log('[DevInspector] Procurando DevInspector Desktop na rede/USB...')
      const discovery = await discoverDesktop()
      if (discovery) {
        targetHost = discovery.host
        console.log(`[DevInspector] Encontrado via probing: ${targetHost}`)
      } else {
        targetHost = getFallbackHost()
        console.log(`[DevInspector] Probing falhou, usando fallback: ${targetHost}`)
      }
    }

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

        // Auto-reconnect dinâmico: se cair, tenta buscar o melhor IP de novo!
        if ((status === 'disconnected' || status === 'retrying') && !host) {
          const checkRecovery = async () => {
            if (this.initCounter !== currentInitId) return
            if (this.transport?.getStatus() === 'connected') return

            const lifesaver = this.transport?.getLifesaverIp()
            const currentTrying = this.transport?.getCurrentHost()
            
            console.log(`[DevInspector] Conexão caindo em ${currentTrying}. Buscando rota alternativa...`)
            const discovery = await discoverDesktop(lifesaver)
            
            if (this.transport?.getStatus() === 'connected' || this.initCounter !== currentInitId) return

            if (discovery && discovery.host !== currentTrying) {
              console.log(`[DevInspector] Rota alternativa encontrada: ${discovery.host}. Reconectando!`)
              this.transport?.connect(discovery.host, port)
            } else {
              // Se não achou nada novo, tenta de novo em 5 segundos
              setTimeout(checkRecovery, 5000)
            }
          }
          
          setTimeout(checkRecovery, 3500)
        }
      },
      onToggleDebugger: (visible) => {
        console.log(`[DevInspector] Desktop solicitou UI In-App visível: ${visible}`)
        this.setVisibility(visible)
      },
      onDbCommand: async (payload: DbCommandPayload) => {
        return this.handleDbCommand(payload)
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

  // --- Métodos de Banco de Dados ---
  
  registerDatabaseDriver(driver: DatabaseDriver): void {
    this.dbDriver = driver
  }

  private async handleDbCommand(payload: DbCommandPayload): Promise<any> {
    if (!this.dbDriver) {
      throw new Error('Nenhum DatabaseDriver foi registrado no app usando DevInspector.registerDatabaseDriver()')
    }
    switch (payload.action) {
      case 'getDatabases':
        return await this.dbDriver.getDatabases()
      case 'getTables':
        if (!payload.dbName) throw new Error('dbName is required')
        return await this.dbDriver.getTables(payload.dbName)
      case 'executeSql':
        if (!payload.dbName || !payload.query) throw new Error('dbName and query are required')
        return await this.dbDriver.executeSql(payload.dbName, payload.query, payload.args)
      default:
        throw new Error(`Ação DB desconhecida: ${payload.action}`)
    }
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
    if (this.notifyTimeout) return
    this.notifyTimeout = setTimeout(() => {
      this.historyListeners.forEach(listener => listener())
      this.notifyTimeout = null
    }, 16) // Batching de ~60fps para evitar travamentos e atualizar fora do ciclo de renderização
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
