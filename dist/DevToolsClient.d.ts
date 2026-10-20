import { DevInspectorTransport } from './transport';
import type { ClientMessage, ConnectionStatus, DevInspectorEvent, DatabaseDriver } from './types';
interface InitOptions {
    host?: string;
    port?: number;
    enabled?: boolean;
}
export declare class DevToolsClient {
    private transport;
    private isInitialized;
    private initCounter;
    private history;
    private historyListeners;
    private isVisible;
    private visibilityListeners;
    private notifyTimeout;
    private appStateSubscription;
    private dbDriver;
    private ignoredRequestIds;
    constructor();
    init(options?: InitOptions): Promise<void>;
    send(message: ClientMessage): void;
    sendEvent(event: DevInspectorEvent): void;
    disconnect(): void;
    destroy(): void;
    registerDatabaseDriver(driver: DatabaseDriver): void;
    private handleDbCommand;
    getHistory(): DevInspectorEvent[];
    subscribeHistory(listener: () => void): () => void;
    private notifyHistoryListeners;
    getIsVisible(): boolean;
    setVisibility(visible: boolean): void;
    subscribeVisibility(listener: (visible: boolean) => void): () => void;
    getStatus(): ConnectionStatus;
    getBufferSize(): number;
    onStatusChange(listener: (status: ConnectionStatus) => void): () => void;
    getTransport(): DevInspectorTransport | null;
    private truncateDeep;
    private estimateObjectSize;
    private safeStringify;
    private convertToEvent;
}
export declare const devToolsClient: DevToolsClient;
export {};
