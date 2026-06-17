import { useShallow } from 'zustand/react/shallow'
import { useNetworkStore } from '../../stores/networkStore'
import { useConsoleStore } from '../../stores/consoleStore'
import { formatBytes } from '../../utils/formatters'
import { SERVER_PORT } from '../../utils/constants'
import packageJson from '../../../../package.json'

export const StatusBar: React.FC = () => {
  const { total, failed, totalSize } = useNetworkStore(
    useShallow((state) => {
      const stats = state.getStats()
      return { total: stats.total, failed: stats.failed, totalSize: stats.totalSize }
    })
  )
  const consoleLogs = useConsoleStore((state) => state.logs.length)

  return (
    <div className="app-statusbar">
      <div className="stat-item" style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>
        v{packageJson.version}
      </div>
      
      <div className="stat-item">
        WebSocket Server: <span className="stat-value">{SERVER_PORT}</span>
      </div>
      
      <div style={{ flex: 1 }} />

      <div className="stat-item">
        Network Requests: <span className="stat-value">{total}</span>
        {failed > 0 && <span className="stat-value error" style={{ marginLeft: 4 }}>({failed} failed)</span>}
      </div>

      <div className="stat-item">
        Transferred: <span className="stat-value">{formatBytes(totalSize)}</span>
      </div>

      <div className="stat-item">
        Console Logs: <span className="stat-value">{consoleLogs}</span>
      </div>
    </div>
  )
}
