import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useVirtualizer } from '@tanstack/react-virtual'

interface JsonViewerProps {
  data: unknown
  maxDepth?: number
  initialExpanded?: boolean
}

type Kind = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | 'undefined'
type NodeType = 'primitive' | 'container-open' | 'container-close' | 'container-summary'

interface FlatRow {
  id: string
  path: string
  depth: number
  keyName?: string
  kind: Kind
  type: NodeType
  value: unknown
  childCount?: number
  isExpanded?: boolean
}

function getKind(val: unknown): Kind {
  if (val === null) return 'null'
  if (val === undefined) return 'undefined'
  const t = typeof val
  if (t === 'string') return 'string'
  if (t === 'number' || t === 'bigint') return 'number'
  if (t === 'boolean') return 'boolean'
  if (Array.isArray(val)) return 'array'
  return 'object'
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  maxDepth = 6,
  initialExpanded = true
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, data: unknown } | null>(null)
  
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    if (initialExpanded) {
      // Semente inicial: expande os dois primeiros níveis
      const traverse = (val: unknown, currentDepth: number, currentPath: string) => {
        if (currentDepth >= 2) return
        const kind = getKind(val)
        if (kind === 'array' || kind === 'object') {
          initial.add(currentPath)
          const entries = kind === 'array' ? (val as any[]) : Object.entries(val as object)
          if (kind === 'array') {
            for (let i = 0; i < (val as any[]).length; i++) {
              traverse((val as any[])[i], currentDepth + 1, `${currentPath}.${i}`)
            }
          } else {
            for (const [k, v] of entries) {
              traverse(v, currentDepth + 1, `${currentPath}.${k}`)
            }
          }
        }
      }
      traverse(data, 0, 'root')
    }
    return initial
  })

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const flatRows = useMemo(() => {
    const rows: FlatRow[] = []
    let idCounter = 0

    const traverse = (val: unknown, currentDepth: number, currentPath: string, keyName?: string) => {
      const kind = getKind(val)
      
      if (kind === 'array' || kind === 'object') {
        const isArray = kind === 'array'
        const childCount = isArray ? (val as any[]).length : Object.keys(val as object).length
        const isExpanded = expandedPaths.has(currentPath)
        
        if (currentDepth >= maxDepth) {
          rows.push({
            id: `row-${idCounter++}`,
            path: currentPath,
            depth: currentDepth,
            keyName,
            kind,
            type: 'container-summary',
            value: val,
            childCount
          })
          return
        }

        rows.push({
          id: `row-${idCounter++}`,
          path: currentPath,
          depth: currentDepth,
          keyName,
          kind,
          type: 'container-open',
          value: val,
          childCount,
          isExpanded
        })

        if (isExpanded) {
          if (isArray) {
            for (let i = 0; i < (val as any[]).length; i++) {
              traverse((val as any[])[i], currentDepth + 1, `${currentPath}.${i}`, String(i))
            }
          } else {
            for (const [k, v] of Object.entries(val as object)) {
              traverse(v, currentDepth + 1, `${currentPath}.${k}`, k)
            }
          }
          rows.push({
            id: `row-${idCounter++}`,
            path: currentPath,
            depth: currentDepth,
            kind,
            type: 'container-close',
            value: val
          })
        }
      } else {
        rows.push({
          id: `row-${idCounter++}`,
          path: currentPath,
          depth: currentDepth,
          keyName,
          kind,
          type: 'primitive',
          value: val
        })
      }
    }

    traverse(data, 0, 'root')
    return rows
  }, [data, expandedPaths, maxDepth])

  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: flatRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20,
    overscan: 10,
  })

  const handleContextMenu = useCallback((e: React.MouseEvent, nodeData: unknown) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, data: nodeData })
  }, [])

  useEffect(() => {
    const closeMenu = () => setContextMenu(null)
    window.addEventListener('click', closeMenu)
    return () => window.removeEventListener('click', closeMenu)
  }, [])

  const handleCopy = () => {
    if (contextMenu) {
      try {
        const text = typeof contextMenu.data === 'string' ? contextMenu.data : JSON.stringify(contextMenu.data, null, 2)
        navigator.clipboard.writeText(text)
      } catch (err) {
        console.error('Failed to copy', err)
      }
    }
    setContextMenu(null)
  }

  return (
    <div
      ref={parentRef}
      className="json-viewer"
      style={{
        position: 'relative',
        height: '100%',
        maxHeight: '100%', 
        overflowY: 'auto'
      }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative'
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = flatRows[virtualItem.index]
          const indent = row.depth * 16

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
                paddingLeft: indent
              }}
              onContextMenu={(e) => handleContextMenu(e, row.value)}
            >
              <JsonRow row={row} onToggle={() => togglePath(row.path)} />
            </div>
          )
        })}
      </div>
      
      {contextMenu && createPortal(
        <div
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            padding: '4px 0',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            zIndex: 9999,
            minWidth: 120
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: 12, color: 'var(--color-text)' }}
            onClick={handleCopy}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            Copiar valor
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const JsonRow = React.memo(({ row, onToggle }: { row: FlatRow, onToggle: () => void }) => {
  if (row.type === 'primitive') {
    if (row.kind === 'null') {
      return (
        <>
          {row.keyName !== undefined && <span className="json-key">"{row.keyName}"</span>}
          {row.keyName !== undefined && <span>: </span>}
          <span className="json-null">null</span>
        </>
      )
    }
    if (row.kind === 'undefined') {
      return (
        <>
          {row.keyName !== undefined && <span className="json-key">"{row.keyName}"</span>}
          {row.keyName !== undefined && <span>: </span>}
          <span className="json-null">undefined</span>
        </>
      )
    }
    if (row.kind === 'string') {
      const str = row.value as string
      return (
        <>
          {row.keyName !== undefined && <span className="json-key">"{row.keyName}"</span>}
          {row.keyName !== undefined && <span>: </span>}
          <span className="json-string">"{str.length > 300 ? str.substring(0, 300) + '...' : str}"</span>
        </>
      )
    }
    if (row.kind === 'number' || row.kind === 'boolean') {
      return (
        <>
          {row.keyName !== undefined && <span className="json-key">"{row.keyName}"</span>}
          {row.keyName !== undefined && <span>: </span>}
          <span className={`json-${row.kind}`}>{String(row.value)}</span>
        </>
      )
    }
  }

  if (row.type === 'container-summary') {
    return (
      <>
        {row.keyName !== undefined && <span className="json-key">"{row.keyName}"</span>}
        {row.keyName !== undefined && <span>: </span>}
        <span className="json-bracket">
          {row.kind === 'array' ? `[Array(${row.childCount})]` : '{...}'}
        </span>
      </>
    )
  }

  if (row.type === 'container-open') {
    return (
      <div style={{ cursor: 'pointer', display: 'inline-block' }} onClick={onToggle}>
        <span className="json-toggle">{row.isExpanded ? '▼' : '▶'}</span>
        {row.keyName !== undefined && <span className="json-key">"{row.keyName}"</span>}
        {row.keyName !== undefined && <span>: </span>}
        <span className="json-bracket">{row.kind === 'array' ? '[' : '{'}</span>
        {!row.isExpanded && (
          <span style={{ color: 'var(--color-text-muted)' }}>
            {' '}{row.childCount} {row.kind === 'array' ? 'items' : 'keys'}{' '}
          </span>
        )}
        {!row.isExpanded && <span className="json-bracket">{row.kind === 'array' ? ']' : '}'}</span>}
      </div>
    )
  }

  if (row.type === 'container-close') {
    return <span className="json-bracket">{row.kind === 'array' ? ']' : '}'}</span>
  }

  return null
})
