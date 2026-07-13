import { initTransport, getTransport, hasTransport, DevInspectorTransport } from './transport'
import { discoverDesktop, getFallbackHost } from './discovery'
import { AppState, type AppStateStatus } from 'react-native'
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
  private appStateSubscription: any = null

  // Driver de Banco de Dados
  private dbDriver: DatabaseDriver | null = null

  // Filtro de requisições internas
  private ignoredRequestIds = new Set<string>()

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

    // Escutar AppState para pausar/retomar a fila e gerenciar conexão
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        console.log('[DevInspector] App em foreground. Retomando processamento de eventos.')
        this.transport?.setPaused(false)
        if (this.transport && !this.transport.isConnected() && targetHost) {
          const hostToUse = this.transport.getCurrentHost() || targetHost
          console.log(`[DevInspector] Tentando reconectar ao ${hostToUse} após voltar do background...`)
          this.transport.connect(hostToUse, port)
        }
      } else if (nextAppState === 'background') {
        console.log('[DevInspector] App em background. Pausando envio para poupar recursos e evitar timeouts.')
        this.transport?.setPaused(true)
      }
    })
  }

  send(message: ClientMessage): void {
    if (!this.isInitialized) return
    
    // Filtro para não poluir o histórico com requisições internas da própria ferramenta
    if (message.type.startsWith('network:request')) {
      const payload = message.payload as any
      const id = payload.id
      
      if (message.type === 'network:request-start') {
        const url = payload.url || ''
        if (url.includes(':8347/ping') || url.includes(':8347/socket.io') || url.includes('/upload-payload')) {
          this.ignoredRequestIds.add(id)
          return
        }
      } else {
        // network:request-end ou network:request-error
        if (this.ignoredRequestIds.has(id)) {
          this.ignoredRequestIds.delete(id)
          return
        }
      }
    }

    // 1. Gera versão sem truncamento para testarmos se precisa do Bypass HTTP
    const fullConverted = this.convertToEvent(message, true)
    if (!fullConverted) return

    let finalStr = ''
    try {
      // É crucial embrulhar no mesmo formato que o WebSocket espera!
      finalStr = JSON.stringify({
        event: 'devinspector:event',
        payload: fullConverted
      })
    } catch (e) {
      console.warn('[DevInspector] Falha ao stringificar evento', e)
    }

    // Se o evento completo tem mais de 1.5MB, usamos o Bypass Nativo via HTTP POST!
    if (finalStr.length > 1500000 && this.transport) {
      const host = this.transport.getCurrentHost()
      const port = this.transport.getCurrentPort()

      if (host) {
        // Envia na íntegra por fora do WebSocket
        fetch(`http://${host}:${port}/upload-payload`, {
          method: 'POST',
          body: finalStr
        }).catch(err => {
          console.warn('[DevInspector] Falha no Bypass HTTP POST:', err)
        })

        // Pro histórico local da Bolha (In-App), temos que truncar pra não acabar com a RAM
        const truncatedConverted = this.convertToEvent(message, false)
        if (truncatedConverted) {
          this.history.unshift(truncatedConverted)
          if (this.history.length > 100) this.history.pop()
          this.notifyHistoryListeners()
        }
        
        return // Encerra (Não enfileira no WebSocket)
      }
    }

    // Fluxo normal via WebSocket (Payload pequeno)
    this.history.unshift(fullConverted)
    if (this.history.length > 100) {
      this.history.pop() // Limita a 100 eventos para não pesar a RAM
    }
    this.notifyHistoryListeners()

    if (this.transport && this.transport.isConnected()) {
      this.transport.send(fullConverted)
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
    if (this.appStateSubscription) {
      this.appStateSubscription.remove()
      this.appStateSubscription = null
    }
  }

  destroy(): void {
    if (this.transport) {
      this.transport.disconnect()
      this.transport = null
    }
    this.isInitialized = false
    this.history = []
    this.historyListeners = []
    if (this.appStateSubscription) {
      this.appStateSubscription.remove()
      this.appStateSubscription = null
    }
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
        return await this.dbDriver.executeSql(payload.dbName, payload.query, payload.args, (chunk) => {
          this.sendEvent({
            type: 'db:chunk',
            payload: { chunk }
          })
        })
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

  private truncateDeep(data: any, maxDepth: number = 4, currentDepth: number = 0): any {
    if (data === null || data === undefined) return data;
    
    if (typeof data === 'string') {
      if (data.length > 5000) {
        return data.substring(0, 5000) + `... [DevInspector: texto truncado]`
      }
      return data;
    }

    if (currentDepth >= maxDepth) {
      if (Array.isArray(data)) return `[Array(${data.length}) omitido]`;
      if (typeof data === 'object') return `[Object omitido]`;
      return data;
    }

    if (Array.isArray(data)) {
      if (data.length > 50) {
        const preview = data.slice(0, 50).map(item => this.truncateDeep(item, maxDepth, currentDepth + 1));
        preview.push({ _devinspector_info: `... mais ${data.length - 50} itens omitidos.` });
        return preview;
      }
      return data.map(item => this.truncateDeep(item, maxDepth, currentDepth + 1));
    }

    if (typeof data === 'object') {
      const entries = Object.entries(data);
      const previewObj: any = {};
      const limit = Math.min(entries.length, 50);
      
      for (let i = 0; i < limit; i++) {
        previewObj[entries[i][0]] = this.truncateDeep(entries[i][1], maxDepth, currentDepth + 1);
      }
      
      if (entries.length > 50) {
        previewObj['_devinspector_info'] = `... mais ${entries.length - 50} chaves omitidas.`;
      }
      return previewObj;
    }

    return data;
  }

  // Helper para proteger o Histórico de payloads gigantescos
  private safeStringify(data: any, skipTruncation: boolean): string {
    if (data === null || data === undefined) return ''
    
    let parsedData = data;

    if (typeof data === 'string') {
      try {
        parsedData = JSON.parse(data)
      } catch (e) {
        if (!skipTruncation && data.length > 1500000) {
          return data.substring(0, 5000) + `\n\n... [DevInspector] Restante truncado. Payload era gigantesco (${(data.length / 1024 / 1024).toFixed(2)} MB).`
        }
        return data 
      }
    }

    try {
      const stringified = JSON.stringify(parsedData)
      if (skipTruncation || stringified.length <= 1500000) {
        return stringified
      }

      // Caiu na malha fina! Trunca pra não explodir a RAM do celular no Histórico In-App
      let safeData = this.truncateDeep(parsedData, 4, 0);
      
      const aviso = `Payload original era pesado (${(stringified.length / 1024 / 1024).toFixed(2)} MB). Foi enviado completo ao Desktop via Bypass, mas podado aqui no Histórico do celular.`
      if (typeof safeData === 'object' && safeData !== null && !Array.isArray(safeData)) {
         safeData['_devinspector_warning'] = aviso
      } else if (Array.isArray(safeData)) {
         safeData.unshift({ _devinspector_warning: aviso })
      }

      return JSON.stringify(safeData)
    } catch (err) {
      return `{"_devinspector_error": "Erro ao serializar payload: ${err instanceof Error ? err.message : String(err)}"}`
    }
  }

  private convertToEvent(message: ClientMessage, skipTruncation: boolean = false): DevInspectorEvent | null {
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
            body: this.safeStringify(message.payload.requestBody, skipTruncation),
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
            body: this.safeStringify(message.payload.responseBody, skipTruncation),
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
