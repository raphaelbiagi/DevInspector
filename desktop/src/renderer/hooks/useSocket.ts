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
    })

    const unsubEnd = window.devInspector.onNetworkRequestEnd((data) => {
      useNetworkStore.getState().updateRequestEnd(data as NetworkRequestEndPayload)
    })

    const unsubError = window.devInspector.onNetworkRequestError((data) => {
      useNetworkStore.getState().updateRequestError(data as NetworkRequestErrorPayload)
    })

    const unsubConsole = window.devInspector.onConsoleLog((data) => {
      useConsoleStore.getState().addLog(data as ConsoleLogEntry)
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
      window.dispatchEvent(new CustomEvent('devinspector:toast', { 
        detail: { type: 'warning', title: 'Anomalia Detectada', message: data.message } 
      }))
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
