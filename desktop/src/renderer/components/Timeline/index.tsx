import React, { useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useTimelineStore, TimelineItem, TimelineItemType } from '../../stores/timelineStore'
import type { AnomalyPayload } from '../../types/protocol'

// --- Componente principal ---

export function TimelinePanel() {
  const parentRef = React.useRef<HTMLDivElement>(null)
  const items = useTimelineStore(state => state.items)
  const selectedId = useTimelineStore(state => state.selectedId)
  const selectItem = useTimelineStore(state => state.selectItem)

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.timestamp - b.timestamp)
  }, [items])

  const virtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 15,
  })

  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📊</div>
        <div>Nenhum evento na timeline</div>
        <div className="empty-subtitle">
          Conecte um dispositivo para ver requests, logs e anomalias em ordem cronológica
        </div>
      </div>
    )
  }

  return (
    <div className="timeline-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Stats bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span>Total</span>
          <span className="stat-value">{items.length}</span>
        </div>
        <div className="stat-item">
          <span>Requests</span>
          <span className="stat-value">{items.filter(i => i.type === 'request').length}</span>
        </div>
        <div className="stat-item">
          <span>Console</span>
          <span className="stat-value">{items.filter(i => i.type === 'console').length}</span>
        </div>
        <div className="stat-item">
          <span>Anomalias</span>
          <span className="stat-value error">{items.filter(i => i.type === 'anomaly').length}</span>
        </div>
      </div>

      {/* Timeline virtualizada */}
      <div
        ref={parentRef}
        style={{ flex: 1, overflow: 'auto', position: 'relative' }}
      >
        {/* Linha vertical da timeline */}
        <div style={{
          position: 'absolute',
          left: 24,
          top: 0,
          bottom: 0,
          width: 2,
          background: 'var(--border-color)',
          zIndex: 0,
        }} />

        <div
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map(virtualItem => {
            const item = sortedItems[virtualItem.index]
            return (
              <div
                key={item.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${virtualItem.start}px)`,
                }}
              >
                <TimelineRow
                  item={item}
                  isSelected={item.id === selectedId}
                  onClick={() => selectItem(item.id)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// --- Linha individual da timeline ---

function TimelineRow({
  item,
  isSelected,
  onClick,
}: {
  item: TimelineItem
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="timeline-row-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '6px 16px 6px 48px',
        cursor: 'pointer',
        background: isSelected ? 'var(--color-accent-dim)' : 'transparent',
        borderBottom: '1px solid rgba(45, 45, 45, 0.5)',
        position: 'relative',
        transition: 'background 0.1s ease',
      }}
    >
      {/* Marcador na linha da timeline */}
      <TimelineDot type={item.type} />

      {/* Timestamp */}
      <span style={{
        fontSize: 11,
        color: 'var(--color-text-muted)',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 80,
        fontFamily: 'var(--font-mono)',
      }}>
        {formatTimestamp(item.timestamp)}
      </span>

      {/* Badge do tipo */}
      <TypeBadge type={item.type} data={item.data} />

      {/* Descrição */}
      <span style={{
        fontSize: 12,
        color: 'var(--color-text)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        flex: 1,
        fontFamily: 'var(--font-mono)',
      }}>
        {getDescription(item)}
      </span>

      {/* Duração (apenas para responses) */}
      {item.type === 'response' && (
        <DurationBadge duration={item.data.duration as number | undefined} />
      )}
    </div>
  )
}

// --- Sub-componentes ---

function TimelineDot({ type }: { type: TimelineItemType }) {
  const colors: Record<TimelineItemType, string> = {
    request:  '#3B82F6',
    response: '#22C55E',
    console:  '#EAB308',
    anomaly:  '#EF4444',
  }
  return (
    <div style={{
      position: 'absolute',
      left: 20,
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: colors[type],
      boxShadow: `0 0 6px ${colors[type]}44`,
      zIndex: 1,
    }} />
  )
}

function TypeBadge({ type, data }: { type: TimelineItemType; data: Record<string, unknown> }) {
  const getLabel = (): string => {
    switch (type) {
      case 'request':  return (data.method as string) ?? 'REQ'
      case 'response': return String(data.statusCode ?? 'RES')
      case 'console':  return ((data.level as string) ?? 'LOG').toUpperCase()
      case 'anomaly':  return '⚠'
    }
  }

  const getColor = (): string => {
    switch (type) {
      case 'request':  return '#3B82F6'
      case 'response': {
        const status = data.statusCode as number
        if (status >= 500) return '#EF4444'
        if (status >= 400) return '#F97316'
        if (status >= 300) return '#EAB308'
        return '#22C55E'
      }
      case 'console': {
        const level = data.level as string
        if (level === 'error') return '#EF4444'
        if (level === 'warn')  return '#EAB308'
        return '#3B82F6'
      }
      case 'anomaly': return '#EF4444'
    }
  }

  return (
    <span style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.05em',
      padding: '2px 6px',
      borderRadius: 4,
      background: getColor(),
      color: '#fff',
      minWidth: 42,
      textAlign: 'center',
      fontFamily: 'var(--font-mono)',
    }}>
      {getLabel()}
    </span>
  )
}

function DurationBadge({ duration }: { duration?: number }) {
  if (duration === undefined) return null
  const ms = duration
  const color = ms > 2000 ? '#EF4444' : ms > 500 ? '#EAB308' : '#22C55E'
  return (
    <span style={{
      fontSize: 11,
      color,
      fontVariantNumeric: 'tabular-nums',
      fontFamily: 'var(--font-mono)',
    }}>
      {ms}ms
    </span>
  )
}

// --- Helpers ---

function getDescription(item: TimelineItem): string {
  switch (item.type) {
    case 'request': {
      return `${item.data.method} ${item.data.url}`
    }
    case 'response': {
      return `${item.data.statusCode} ${item.data.statusText ?? ''}`
    }
    case 'console': {
      return ((item.data.message as string) ?? '').slice(0, 120)
    }
    case 'anomaly': {
      return (item.data as unknown as AnomalyPayload).description
    }
  }
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  const ms = String(d.getMilliseconds()).padStart(3, '0')
  return `${h}:${m}:${s}.${ms}`
}
