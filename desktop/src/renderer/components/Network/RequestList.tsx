import React, { useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useNetworkStore } from '../../stores/networkStore'
import { RequestRow } from './RequestRow'

export const RequestList: React.FC = () => {
  const requests = useNetworkStore(useShallow((state) => state.getFilteredRequests()))
  const selectedId = useNetworkStore((state) => state.selectedId)
  const selectRequest = useNetworkStore((state) => state.selectRequest)
  
  const parentRef = useRef<HTMLDivElement>(null)
  
  const rowVirtualizer = useVirtualizer({
    count: requests.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 30,
    overscan: 10,
  })

  // Auto-scroll to bottom logic
  const [autoScroll, setAutoScroll] = React.useState(true)
  const lastCount = useRef(requests.length)

  useEffect(() => {
    if (autoScroll && requests.length > lastCount.current) {
      rowVirtualizer.scrollToIndex(requests.length - 1, { align: 'end' })
    }
    lastCount.current = requests.length
  }, [requests.length, autoScroll])

  const handleScroll = () => {
    if (!parentRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }

  return (
    <div className="request-list-container" ref={parentRef} onScroll={handleScroll}>
      <div className="request-list-header">
        <div>Status</div>
        <div>Method</div>
        <div>URL</div>
        <div style={{ textAlign: 'right' }}>Time</div>
        <div style={{ textAlign: 'right' }}>Size</div>
      </div>
      
      {requests.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🌐</div>
          <div>No requests found</div>
          <div className="empty-subtitle">Make sure the app is connected and making HTTP requests.</div>
        </div>
      ) : (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const req = requests[virtualItem.index]
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualItem.size}px`,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <RequestRow
                  request={req}
                  isSelected={selectedId === req.id}
                  onClick={() => selectRequest(req.id)}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
