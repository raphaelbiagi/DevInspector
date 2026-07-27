import React, { useState, useRef } from 'react'
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
  const setPanelWidth = useNetworkStore((state) => state.setPanelWidth)
  const [showTimeline, setShowTimeline] = useState(false)
  const isDragging = useRef(false)

  const handleMouseDown = () => {
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) return
    const newWidth = window.innerWidth - e.clientX
    if (newWidth > 320 && newWidth < 800) {
      setPanelWidth(newWidth)
    }
  }

  const handleMouseUp = () => {
    isDragging.current = false
    document.body.style.cursor = ''
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

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
            <div className="split-panel-divider" onMouseDown={handleMouseDown} />
            <RequestDetail request={selectedRequest} onClose={() => selectRequest(null)} />
          </>
        )}
      </div>

      <NetworkStats />
    </div>
  )
}
