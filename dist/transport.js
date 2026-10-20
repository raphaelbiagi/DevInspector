const MAX_BUFFER_SIZE = 500;
export class DevInspectorTransport {
    constructor(config) {
        this.socket = null;
        this.eventQueue = [];
        this.isProcessingQueue = false;
        this.isPaused = false;
        this.status = 'disconnected';
        this.listeners = [];
        this.currentHost = null;
        this.currentPort = 8347;
        this.lifesaverIp = null;
        // Lógica de Reconexão e Estabilidade
        this.reconnectTimer = null;
        this.watchdogTimer = null;
        this.offlineTime = 0;
        this.intentionallyClosed = false;
        // Callbacks de ACK
        this.pendingAcks = new Map();
        this.config = config;
    }
    connect(host, port) {
        this.currentHost = host;
        this.currentPort = port;
        this.intentionallyClosed = false;
        this.cleanup();
        const url = `ws://${host}:${port}`;
        this.setStatus('retrying');
        try {
            // Inicializa o WebSocket Nativo (roda em background thread no Android/iOS)
            this.socket = new WebSocket(url);
        }
        catch (e) {
            this.scheduleReconnect();
            return;
        }
        this.socket.onopen = () => {
            this.setStatus('connected');
            this.offlineTime = 0;
            this.processQueue();
        };
        this.socket.onmessage = (e) => {
            try {
                const parsed = JSON.parse(e.data);
                const { event, payload, ackId } = parsed;
                if (event === 'server:ipv4' && payload) {
                    console.log(`[DevInspector] Bóia de Salvação guardada na memória: ${payload}`);
                    this.lifesaverIp = payload;
                }
                else if (event === 'server:clear-logs') {
                    // O botão "Limpar" do desktop também esvazia o buffer local do app,
                    // para que a UI In-App (bolha) não continue mostrando o que já foi limpo.
                    this.eventQueue = [];
                    this.config.onClearLogs?.();
                }
                else if (event === 'server:toggle-debugger') {
                    this.config.onToggleDebugger?.(payload.enabled);
                }
                else if (event === 'server:db:execute') {
                    if (this.config.onDbCommand) {
                        this.config.onDbCommand(payload).then(result => {
                            this.sendRaw('server:db:response', { success: true, data: result }, ackId);
                        }).catch(err => {
                            this.sendRaw('server:db:response', { success: false, error: err?.message || String(err) }, ackId);
                        });
                    }
                    else {
                        this.sendRaw('server:db:response', { success: false, error: 'O app não configurou o onDbCommand.' }, ackId);
                    }
                }
                else if (event === 'ack') {
                    const cb = this.pendingAcks.get(ackId);
                    if (cb) {
                        this.pendingAcks.delete(ackId);
                        cb();
                    }
                }
            }
            catch (err) { }
        };
        this.socket.onclose = () => {
            if (!this.intentionallyClosed) {
                this.setStatus('retrying');
                this.scheduleReconnect();
            }
            else {
                this.setStatus('disconnected');
            }
        };
        this.socket.onerror = (e) => {
            // O evento onClose normalmente é disparado em seguida. Não reconectamos 2x.
        };
        // Watchdog agressivo: Força reinicialização do socket se ficar preso conectando
        this.watchdogTimer = setInterval(() => {
            if (this.status !== 'connected' && !this.isPaused && !this.intentionallyClosed) {
                this.offlineTime += 2000;
                if (this.offlineTime >= 15000) {
                    console.log('[DevInspector] Watchdog detectou socket travado. Forçando recriação completa!');
                    this.offlineTime = 0;
                    this.connect(host, port);
                }
            }
            else {
                this.offlineTime = 0;
            }
        }, 2000);
    }
    scheduleReconnect() {
        if (this.reconnectTimer)
            clearTimeout(this.reconnectTimer);
        if (this.intentionallyClosed)
            return;
        this.reconnectTimer = setTimeout(() => {
            if (this.currentHost && !this.intentionallyClosed) {
                this.connect(this.currentHost, this.config.port || 8347);
            }
        }, 3000);
    }
    cleanup() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        if (this.watchdogTimer) {
            clearInterval(this.watchdogTimer);
            this.watchdogTimer = null;
        }
        if (this.socket) {
            this.socket.onclose = null;
            this.socket.onerror = null;
            this.socket.onmessage = null;
            this.socket.onopen = null;
            this.socket.close();
            this.socket = null;
        }
    }
    // Helper interno para enviar mensagens no formato padronizado do WebSocketServer
    sendRaw(event, payload, ackId) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({ event, payload, ackId }));
        }
    }
    send(event) {
        if (this.eventQueue.length < MAX_BUFFER_SIZE) {
            this.eventQueue.push(event);
        }
        this.processQueue();
    }
    /**
     * Envia mensagem legada
     */
    sendLegacy(event, payload) {
        this.sendRaw(event, payload);
    }
    onStatusChange(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }
    destroy() {
        this.disconnect();
        this.listeners = [];
    }
    getCurrentPort() {
        return this.currentPort;
    }
    getStatus() {
        return this.status;
    }
    getBufferSize() {
        return this.eventQueue.length;
    }
    getCurrentHost() {
        return this.currentHost;
    }
    getLifesaverIp() {
        return this.lifesaverIp;
    }
    isConnected() {
        return this.socket?.readyState === WebSocket.OPEN;
    }
    disconnect() {
        this.intentionallyClosed = true;
        this.cleanup();
        this.eventQueue = [];
        this.pendingAcks.clear();
        this.setStatus('disconnected');
    }
    setPaused(paused) {
        this.isPaused = paused;
        if (!paused && this.isConnected()) {
            this.processQueue();
        }
    }
    async processQueue() {
        if (this.isProcessingQueue || !this.isConnected() || this.eventQueue.length === 0 || this.isPaused) {
            return;
        }
        this.isProcessingQueue = true;
        try {
            while (this.eventQueue.length > 0 && this.isConnected()) {
                const event = this.eventQueue[0];
                // Identificador para emular o sistema de ACK que tínhamos no Socket.IO
                const ackId = Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
                // Aguarda a confirmação (ACK) do servidor
                await new Promise((resolve, reject) => {
                    const timer = setTimeout(() => {
                        this.pendingAcks.delete(ackId);
                        reject(new Error('ACK Timeout'));
                    }, 5000);
                    this.pendingAcks.set(ackId, () => {
                        clearTimeout(timer);
                        resolve();
                    });
                    this.sendRaw('devinspector:event', event, ackId);
                });
                // Se chegou aqui, o servidor confirmou o recebimento. Removemos da fila.
                this.eventQueue.shift();
                // Yielding: Dar respiro à thread JS para não bloquear o aplicativo e permitir animações
                await new Promise(r => setTimeout(r, 10));
            }
        }
        catch (error) {
            // Falha ao receber o ACK (timeout ou desconexão).
            // O loop é interrompido. Os eventos não confirmados permanecem na fila.
        }
        finally {
            this.isProcessingQueue = false;
            // Tenta retomar se ainda houver eventos (ex: erro de timeout na rede instável)
            if (this.eventQueue.length > 0 && this.isConnected() && !this.isPaused) {
                setTimeout(() => this.processQueue(), 1000);
            }
        }
    }
    setStatus(status) {
        if (this.status === status)
            return;
        this.status = status;
        this.config.onStatusChange?.(status);
        this.listeners.forEach(l => l(status));
    }
}
// Singleton para uso no SDK
let _transport = null;
export function getTransport() {
    if (!_transport)
        throw new Error('[DevInspector] Transport não inicializado. Chame DevInspector.init() primeiro.');
    return _transport;
}
export function initTransport(config) {
    if (_transport) {
        _transport.disconnect();
    }
    _transport = new DevInspectorTransport(config);
    return _transport;
}
export function hasTransport() {
    return _transport !== null;
}
//# sourceMappingURL=transport.js.map