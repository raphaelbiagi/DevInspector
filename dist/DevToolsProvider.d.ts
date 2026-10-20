import React, { ReactNode } from 'react';
export interface DevToolsProviderProps {
    children: ReactNode;
    /** Liga o DevInspector. Padrão: `__DEV__` — desligado em builds de produção. */
    enabled?: boolean;
    /** Fixa o IP do desktop, pulando o auto-discovery. */
    host?: string;
    port?: number;
    /** Exibe a bolha de debug dentro do próprio app. */
    showFloatingButton?: boolean;
}
/**
 * Provider do DevInspector para React Native.
 *
 * Uso zero-config:
 * ```tsx
 * <DevProvider>
 *   <App />
 * </DevProvider>
 * ```
 *
 * Com host manual (fallback):
 * ```tsx
 * <DevProvider host="192.168.0.105">
 *   <App />
 * </DevProvider>
 * ```
 */
export declare const DevToolsProvider: React.FC<DevToolsProviderProps>;
export declare const DevProvider: React.FC<DevToolsProviderProps>;
