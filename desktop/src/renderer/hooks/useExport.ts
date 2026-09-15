import { useCallback } from 'react'
import { useNetworkStore } from '../stores/networkStore'
import { useConsoleStore } from '../stores/consoleStore'
import { useTimelineStore } from '../stores/timelineStore'
import { notify } from '../utils/notify'
import { buildHar } from '../utils/har'
import { APP_VERSION } from '../utils/constants'

export type ExportFormat = 'json' | 'har'

export function useExport() {
  const handleExport = useCallback(async (format: ExportFormat = 'json') => {
    if (!window.devInspector) return

    const networkRequests = Array.from(useNetworkStore.getState().requests.values())
    const consoleLogs = useConsoleStore.getState().logs
    const anomalies = useTimelineStore.getState().anomalies

    if (format === 'har' && networkRequests.length === 0) {
      notify('warning', 'Nada para exportar', 'Nenhuma requisição capturada nesta sessão.')
      return
    }

    const timestamp = new Date().getTime()
    const defaultName =
      format === 'har'
        ? `devinspector-${timestamp}.har`
        : `devinspector-export-${timestamp}.json`

    const content =
      format === 'har'
        ? buildHar(networkRequests, APP_VERSION)
        : JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              metadata: {
                networkRequestsCount: networkRequests.length,
                consoleLogsCount: consoleLogs.length,
                anomaliesCount: anomalies.length
              },
              network: networkRequests,
              console: consoleLogs,
              anomalies
            },
            null,
            2
          )

    try {
      const filePath = await window.devInspector.exportSaveDialog(defaultName)
      if (!filePath) return

      await window.devInspector.writeExportFile(filePath, content)

      notify(
        'success',
        'Exportação concluída',
        format === 'har'
          ? `${networkRequests.length} requisições salvas em HAR. Abra no Chrome DevTools, Insomnia ou Postman.`
          : `${networkRequests.length} requisições e ${consoleLogs.length} logs salvos.`
      )
    } catch (err) {
      console.error('Export failed:', err)
      notify('error', 'Falha na exportação', err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }, [])

  return { handleExport }
}
