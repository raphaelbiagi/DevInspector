import React, { useEffect, useState, ReactNode } from 'react'
import { devToolsClient } from './DevToolsClient'
import { installFetchInterceptor, uninstallFetchInterceptor } from './interceptors/fetchInterceptor'
import { installXhrInterceptor, uninstallXhrInterceptor } from './interceptors/xhrInterceptor'
import { installConsoleInterceptor, uninstallConsoleInterceptor } from './interceptors/consoleInterceptor'
import { FloatingDebugger } from './components/FloatingDebugger'

export interface DevToolsProviderProps {
  children: ReactNode
  enabled?: boolean
  host?: string
  port?: number
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
  enabled = true,
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
