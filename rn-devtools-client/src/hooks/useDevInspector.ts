import { useEffect, useState, useCallback } from 'react'
import { devToolsClient } from '../DevToolsClient'
import type { ConnectionStatus } from '../types'

interface DevInspectorStatus {
  status: ConnectionStatus
  bufferedEvents: number
  isConnected: boolean
  isRetrying: boolean
}

/**
 * Hook para monitorar o status de conexão do DevInspector.
 *
 * Uso:
 * ```tsx
 * function DevIndicator() {
 *   const { status, bufferedEvents, isConnected } = useDevInspector()
 *
 *   return (
 *     <View style={{ position: 'absolute', top: 50, right: 10 }}>
 *       <View style={{
 *         width: 8, height: 8, borderRadius: 4,
 *         backgroundColor: isConnected ? 'green' : status === 'retrying' ? 'orange' : 'gray'
 *       }} />
 *       {bufferedEvents > 0 && <Text>{bufferedEvents}</Text>}
 *     </View>
 *   )
 * }
 * ```
 */
export function useDevInspector(): DevInspectorStatus {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [bufferedEvents, setBufferedEvents] = useState(0)

  const refresh = useCallback(() => {
    try {
      setStatus(devToolsClient.getStatus())
      setBufferedEvents(devToolsClient.getBufferSize())
    } catch {
      setStatus('disconnected')
    }
  }, [])

  useEffect(() => {
    refresh()

    const cleanup = devToolsClient.onStatusChange((newStatus) => {
      setStatus(newStatus)
      setBufferedEvents(devToolsClient.getBufferSize())
    })

    return cleanup
  }, [refresh])

  return {
    status,
    bufferedEvents,
    isConnected: status === 'connected',
    isRetrying: status === 'retrying',
  }
}
