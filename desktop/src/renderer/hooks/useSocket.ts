import { useEffect } from 'react'
import { useNetworkStore } from '../stores/networkStore'
import { useConsoleStore } from '../stores/consoleStore'
import { useConnectionStore } from '../stores/connectionStore'
import { useTimelineStore } from '../stores/timelineStore'
import { 
  NetworkRequestStartPayload, 
  NetworkRequestEndPayload, 
  NetworkRequestErrorPayload 
} from '../types/network'
import { ConsoleLogEntry } from '../types/console'
import { ConnectionStatusPayload, AnomalyPayload, RequestDiffPayload } from '../types/protocol'

export function useSocketListener() {
  useEffect(() => {
    if (!window.devInspector) {
      console.warn('devInspector API not available in window. Preload script might be missing.')
      return
    }

    // =============================================
    // Listeners legados (compatibilidade)
    // =============================================
    const unsubStart = window.devInspector.onNetworkRequestStart((data) => {
      useNetworkStore.getState().addRequestStart(data as NetworkRequestStartPayload)

      // Adiciona à timeline
      useTimelineStore.getState().addItem({
        id: data.id,
        timestamp: data.startTime,
        type: 'request',
        data: data,
      })
    })

    const unsubEnd = window.devInspector.onNetworkRequestEnd((data) => {
      useNetworkStore.getState().updateRequestEnd(data as NetworkRequestEndPayload)

      // Adiciona à timeline
      useTimelineStore.getState().addItem({
        id: `${data.id}-response`,
        timestamp: data.endTime,
        type: 'response',
        data: data,
        correlationId: data.id,
      })
    })

    const unsubError = window.devInspector.onNetworkRequestError((data) => {
      useNetworkStore.getState().updateRequestError(data as NetworkRequestErrorPayload)
    })

    const unsubConsole = window.devInspector.onConsoleLog((data) => {
      useConsoleStore.getState().addLog(data as ConsoleLogEntry)

      // Adiciona à timeline
      const entry = data as ConsoleLogEntry
      const message = entry.args
        ?.map((a: any) => {
          if (typeof a.value === 'string') return a.value
          if (a.preview) return a.preview
          try { return JSON.stringify(a.value) } catch { return String(a.value) }
        })
        .join(' ') ?? ''

      useTimelineStore.getState().addItem({
        id: entry.id,
        timestamp: entry.timestamp,
        type: 'console',
        data: { ...entry, message },
      })
    })

    const unsubStatus = window.devInspector.onConnectionStatus((data: ConnectionStatusPayload) => {
      if (data.connected && data.clientInfo) {
        useConnectionStore.getState().setConnected(data.clientInfo)
      } else {
        useConnectionStore.getState().setDisconnected()
      }
    })

    // =============================================
    // Novos listeners do protocolo unificado
    // =============================================
    const unsubAnomaly = window.devInspector.onDevinspectorAnomaly((data: AnomalyPayload) => {
      useTimelineStore.getState().addAnomaly(data)
    })

    const unsubDiff = window.devInspector.onDevinspectorDiff((data: RequestDiffPayload) => {
      useTimelineStore.getState().addDiff(data)
    })

    return () => {
      unsubStart()
      unsubEnd()
      unsubError()
      unsubConsole()
      unsubStatus()
      unsubAnomaly()
      unsubDiff()
    }
  }, [])
}
