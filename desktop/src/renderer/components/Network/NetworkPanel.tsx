import React, { useState } from 'react'
import { NetworkToolbar } from './NetworkToolbar'
import { NetworkStats } from './NetworkStats'
import { RequestList } from './RequestList'
import { RequestDetail } from './RequestDetail'
import { Timeline } from './Timeline'
import { useNetworkStore } from '../../stores/networkStore'

export const NetworkPanel: React.FC = () => {
  const selectedId = useNetworkStore((state) => state.selectedId)
  const selectedRequest = useNetworkStore((state) => state.getSelectedRequest())
  const selectRequest = useNetworkStore((state) => state.selectRequest)
  const [showTimeline, setShowTimeline] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <NetworkToolbar />
      
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
        <label style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', width: 'max-content' }}>
          <input type="checkbox" checked={showTimeline} onChange={(e) => setShowTimeline(e.target.checked)} />
          Mostrar Timeline em Cascata
        </label>
      </div>

      <div className="split-panel">
        <div className="split-panel-left">
          {showTimeline ? (
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Timeline />
            </div>
          ) : (
            <RequestList />
          )}
        </div>

        {selectedId && selectedRequest && (
          <>
            <div className="split-panel-divider" />
            <RequestDetail request={selectedRequest} onClose={() => selectRequest(null)} />
          </>
        )}
      </div>

      <NetworkStats />
    </div>
  )
}
