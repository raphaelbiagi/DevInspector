import type { DevInspectorEvent, ConnectionStatus } from './types';
interface TransportConfig {
    host?: string;
    port?: number;
    onStatusChange?: (status: ConnectionStatus) => void;
    onToggleDebugger?: (visible: boolean) => void;
    onClearLogs?: () => void;
    onDbCommand?: (payload: any) => Promise<any>;
}
export declare class DevInspectorTransport {
    private socket;
    private eventQueue;
    private isProcessingQueue;
    private isPaused;
    private status;
    private config;
    private listeners;
    private currentHost;
    private currentPort;
    private lifesaverIp;
    private reconnectTimer;
    private watchdogTimer;
    private offlineTime;
    private intentionallyClosed;
    private pendingAcks;
    constructor(config: TransportConfig);
    connect(host: string, port: number): void;
    private scheduleReconnect;
    private cleanup;
    private sendRaw;
    send(event: DevInspectorEvent): void;
    /**
     * Envia mensagem legada
     */
    sendLegacy(event: string, payload: unknown): void;
    onStatusChange(listener: (status: ConnectionStatus) => void): () => void;
    destroy(): void;
    getCurrentPort(): number;
    getStatus(): ConnectionStatus;
    getBufferSize(): number;
    getCurrentHost(): string | null;
    getLifesaverIp(): string | null;
    isConnected(): boolean;
    disconnect(): void;
    setPaused(paused: boolean): void;
    private processQueue;
    private setStatus;
}
export declare function getTransport(): DevInspectorTransport;
export declare function initTransport(config: TransportConfig): DevInspectorTransport;
export declare function hasTransport(): boolean;
export {};
