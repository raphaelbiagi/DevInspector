import { useCallback } from 'react'
import { useNetworkStore } from '../stores/networkStore'
import { useConsoleStore } from '../stores/consoleStore'

export function useExport() {
  const handleExport = useCallback(async () => {
    if (!window.devInspector) return

    const networkRequests = Array.from(useNetworkStore.getState().requests.values())
    const consoleLogs = useConsoleStore.getState().logs

    const exportData = {
      timestamp: new Date().toISOString(),
      metadata: {
        networkRequestsCount: networkRequests.length,
        consoleLogsCount: consoleLogs.length
      },
      network: networkRequests,
      console: consoleLogs
    }

    try {
      const defaultName = `devinspector-export-${new Date().getTime()}.json`
      const filePath = await window.devInspector.exportSaveDialog(defaultName)
      
      if (filePath) {
        await window.devInspector.writeExportFile(filePath, JSON.stringify(exportData, null, 2))
        alert('Data exported successfully!')
      }
    } catch (err) {
      console.error('Export failed:', err)
      alert('Failed to export data')
    }
  }, [])

  return { handleExport }
}
