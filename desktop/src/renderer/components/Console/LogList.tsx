import React, { useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useConsoleStore } from '../../stores/consoleStore'
import { LogRow } from './LogRow'

export const LogList: React.FC = () => {
  const logs = useConsoleStore(useShallow((state) => state.getFilteredLogs()))
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 26,
    overscan: 20,
  })

  // Auto-scroll to bottom logic
  const [autoScroll, setAutoScroll] = React.useState(true)
  const lastCount = useRef(logs.length)

  useEffect(() => {
    if (autoScroll && logs.length > lastCount.current) {
      rowVirtualizer.scrollToIndex(logs.length - 1, { align: 'end' })
    }
    lastCount.current = logs.length
  }, [logs.length, autoScroll])

  const handleScroll = () => {
    if (!parentRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50
    setAutoScroll(isAtBottom)
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }} ref={parentRef} onScroll={handleScroll}>
      {logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div>No logs found</div>
          <div className="empty-subtitle">Use console.log() in your React Native app to see output here.</div>
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
            const log = logs[virtualItem.index]
            return (
              <div
                key={virtualItem.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                ref={rowVirtualizer.measureElement}
                data-index={virtualItem.index}
              >
                <LogRow log={log} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
