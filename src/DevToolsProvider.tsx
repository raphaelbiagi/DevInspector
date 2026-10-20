import React, { useEffect, useState, ReactNode } from 'react'
import { devToolsClient } from './DevToolsClient'
import { installFetchInterceptor, uninstallFetchInterceptor } from './interceptors/fetchInterceptor'
import { installXhrInterceptor, uninstallXhrInterceptor } from './interceptors/xhrInterceptor'
import { installConsoleInterceptor, uninstallConsoleInterceptor } from './interceptors/consoleInterceptor'
import { FloatingDebugger } from './components/FloatingDebugger'

export interface DevToolsProviderProps {
  children: ReactNode
  /** Liga o DevInspector. Padrão: `__DEV__` — desligado em builds de produção. */
  enabled?: boolean
  /** Fixa o IP do desktop, pulando o auto-discovery. */
  host?: string
  port?: number
  /** Exibe a bolha de debug dentro do próprio app. */
  showFloatingButton?: boolean
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
export const DevToolsProvider: React.FC<DevToolsProviderProps> = ({
  children,
  // Default seguro: esquecer de passar `enabled` não pode significar subir para
  // a loja interceptando fetch/XHR/console (headers e body incluem Authorization).
  enabled = __DEV__,
  host,
  port = 8347,
  showFloatingButton = false
}) => {
  const [isClientReady, setIsClientReady] = useState(false)

  useEffect(() => {
    if (!enabled) return

    // 1. Inicializa o client (com auto-discovery se host não informado)
    installFetchInterceptor(devToolsClient)
    installXhrInterceptor(devToolsClient)
    installConsoleInterceptor(devToolsClient)

    devToolsClient.init({ host, port, enabled }).then(() => {
      setIsClientReady(true)
    })

    // Cleanup on unmount
    return () => {
      uninstallFetchInterceptor()
      uninstallXhrInterceptor()
      uninstallConsoleInterceptor()
      devToolsClient.destroy()
    }
  }, [enabled, host, port])

  return (
    <>
      {children}
      {enabled && showFloatingButton && <FloatingDebugger />}
    </>
  )
}

// Alias para uso mais conciso
export const DevProvider = DevToolsProvider
