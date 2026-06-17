import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useNetworkStore } from '../../stores/networkStore'
import { formatBytes, formatDuration } from '../../utils/formatters'

export const NetworkStats: React.FC = () => {
  const stats = useNetworkStore(useShallow((state) => state.getStats()))

  return (
    <div className="stats-bar">
      <div className="stat-item">
        Total: <span className="stat-value">{stats.total}</span>
      </div>
      <div className="stat-item">
        Completed: <span className="stat-value" style={{ color: 'var(--color-success)' }}>{stats.completed}</span>
      </div>
      <div className="stat-item">
        Errors: <span className={`stat-value ${stats.failed > 0 ? 'error' : ''}`}>{stats.failed}</span>
      </div>
      <div className="stat-item">
        Pending: <span className="stat-value" style={{ color: 'var(--color-warning)' }}>{stats.pending}</span>
      </div>
      <div style={{ flex: 1 }} />
      <div className="stat-item">
        Avg Time: <span className="stat-value">{formatDuration(stats.avgDuration)}</span>
      </div>
      <div className="stat-item">
        Transferred: <span className="stat-value">{formatBytes(stats.totalSize)}</span>
      </div>
    </div>
  )
}
