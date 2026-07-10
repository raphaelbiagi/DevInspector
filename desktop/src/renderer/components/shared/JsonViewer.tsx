import React, { useState, useCallback, useEffect } from 'react'

interface JsonViewerProps {
  data: unknown
  maxDepth?: number
  initialExpanded?: boolean
}

export const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  maxDepth = 6,
  initialExpanded = true
}) => {
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, data: unknown } | null>(null)

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
    <div className="json-viewer" style={{ position: 'relative' }}>
      <JsonNode
        value={data}
        depth={0}
        maxDepth={maxDepth}
        initialExpanded={initialExpanded}
        onContextMenu={handleContextMenu}
      />
      {contextMenu && (
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
        </div>
      )}
    </div>
  )
}

interface JsonNodeProps {
  value: unknown
  depth: number
  maxDepth: number
  keyName?: string
  initialExpanded: boolean
  onContextMenu: (e: React.MouseEvent, data: unknown) => void
}

const JsonNode: React.FC<JsonNodeProps> = ({ value, depth, maxDepth, keyName, initialExpanded, onContextMenu }) => {
  const [expanded, setExpanded] = useState(depth < 2 && initialExpanded)
  const toggle = useCallback(() => setExpanded((e) => !e), [])

  const indent = depth * 16

  if (value === null) {
    return (
      <div style={{ paddingLeft: indent }} onContextMenu={(e) => onContextMenu(e, value)}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span>: </span>}
        <span className="json-null">null</span>
      </div>
    )
  }

  if (value === undefined) {
    return (
      <div style={{ paddingLeft: indent }} onContextMenu={(e) => onContextMenu(e, value)}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span>: </span>}
        <span className="json-null">undefined</span>
      </div>
    )
  }

  const type = typeof value

  if (type === 'string') {
    const str = value as string
    return (
      <div style={{ paddingLeft: indent }} onContextMenu={(e) => onContextMenu(e, value)}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span>: </span>}
        <span className="json-string">"{str.length > 300 ? str.substring(0, 300) + '...' : str}"</span>
      </div>
    )
  }

  if (type === 'number' || type === 'bigint') {
    return (
      <div style={{ paddingLeft: indent }} onContextMenu={(e) => onContextMenu(e, value)}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span>: </span>}
        <span className="json-number">{String(value)}</span>
      </div>
    )
  }

  if (type === 'boolean') {
    return (
      <div style={{ paddingLeft: indent }} onContextMenu={(e) => onContextMenu(e, value)}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span>: </span>}
        <span className="json-boolean">{String(value)}</span>
      </div>
    )
  }

  if (Array.isArray(value)) {
    if (depth >= maxDepth) {
      return (
        <div style={{ paddingLeft: indent }} onContextMenu={(e) => onContextMenu(e, value)}>
          {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
          {keyName !== undefined && <span>: </span>}
          <span className="json-bracket">[Array({value.length})]</span>
        </div>
      )
    }

    return (
      <div onContextMenu={(e) => onContextMenu(e, value)}>
        <div style={{ paddingLeft: indent, cursor: 'pointer' }} onClick={toggle}>
          <span className="json-toggle">{expanded ? '▼' : '▶'}</span>
          {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
          {keyName !== undefined && <span>: </span>}
          <span className="json-bracket">[</span>
          {!expanded && (
            <span style={{ color: 'var(--color-text-muted)' }}>
              {' '}{value.length} items{' '}
            </span>
          )}
          {!expanded && <span className="json-bracket">]</span>}
        </div>
        {expanded && (
          <>
            {value.map((item, i) => (
              <JsonNode
                key={i}
                value={item}
                depth={depth + 1}
                maxDepth={maxDepth}
                keyName={String(i)}
                initialExpanded={initialExpanded}
                onContextMenu={onContextMenu}
              />
            ))}
            <div style={{ paddingLeft: indent }}>
              <span className="json-bracket">]</span>
            </div>
          </>
        )}
      </div>
    )
  }

  if (type === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)

    if (depth >= maxDepth) {
      return (
        <div style={{ paddingLeft: indent }} onContextMenu={(e) => onContextMenu(e, value)}>
          {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
          {keyName !== undefined && <span>: </span>}
          <span className="json-bracket">{'{...}'}</span>
        </div>
      )
    }

    return (
      <div onContextMenu={(e) => onContextMenu(e, value)}>
        <div style={{ paddingLeft: indent, cursor: 'pointer' }} onClick={toggle}>
          <span className="json-toggle">{expanded ? '▼' : '▶'}</span>
          {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
          {keyName !== undefined && <span>: </span>}
          <span className="json-bracket">{'{'}</span>
          {!expanded && (
            <span style={{ color: 'var(--color-text-muted)' }}>
              {' '}{keys.length} keys{' '}
            </span>
          )}
          {!expanded && <span className="json-bracket">{'}'}</span>}
        </div>
        {expanded && (
          <>
            {keys.map((k) => (
              <JsonNode
                key={k}
                value={obj[k]}
                depth={depth + 1}
                maxDepth={maxDepth}
                keyName={k}
                initialExpanded={initialExpanded}
                onContextMenu={onContextMenu}
              />
            ))}
            <div style={{ paddingLeft: indent }}>
              <span className="json-bracket">{'}'}</span>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div style={{ paddingLeft: indent }} onContextMenu={(e) => onContextMenu(e, value)}>
      {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
      {keyName !== undefined && <span>: </span>}
      <span className="json-string">{String(value)}</span>
    </div>
  )
}
