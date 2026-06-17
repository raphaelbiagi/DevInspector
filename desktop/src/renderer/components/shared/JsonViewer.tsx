import React, { useState, useCallback } from 'react'

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
  return (
    <div className="json-viewer">
      <JsonNode value={data} depth={0} maxDepth={maxDepth} initialExpanded={initialExpanded} />
    </div>
  )
}

interface JsonNodeProps {
  value: unknown
  depth: number
  maxDepth: number
  keyName?: string
  initialExpanded: boolean
}

const JsonNode: React.FC<JsonNodeProps> = ({ value, depth, maxDepth, keyName, initialExpanded }) => {
  const [expanded, setExpanded] = useState(depth < 2 && initialExpanded)
  const toggle = useCallback(() => setExpanded((e) => !e), [])

  const indent = depth * 16

  if (value === null) {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span>: </span>}
        <span className="json-null">null</span>
      </div>
    )
  }

  if (value === undefined) {
    return (
      <div style={{ paddingLeft: indent }}>
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
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span>: </span>}
        <span className="json-string">"{str.length > 300 ? str.substring(0, 300) + '...' : str}"</span>
      </div>
    )
  }

  if (type === 'number' || type === 'bigint') {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span>: </span>}
        <span className="json-number">{String(value)}</span>
      </div>
    )
  }

  if (type === 'boolean') {
    return (
      <div style={{ paddingLeft: indent }}>
        {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
        {keyName !== undefined && <span>: </span>}
        <span className="json-boolean">{String(value)}</span>
      </div>
    )
  }

  if (Array.isArray(value)) {
    if (depth >= maxDepth) {
      return (
        <div style={{ paddingLeft: indent }}>
          {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
          {keyName !== undefined && <span>: </span>}
          <span className="json-bracket">[Array({value.length})]</span>
        </div>
      )
    }

    return (
      <div>
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
        <div style={{ paddingLeft: indent }}>
          {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
          {keyName !== undefined && <span>: </span>}
          <span className="json-bracket">{'{...}'}</span>
        </div>
      )
    }

    return (
      <div>
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
    <div style={{ paddingLeft: indent }}>
      {keyName !== undefined && <span className="json-key">"{keyName}"</span>}
      {keyName !== undefined && <span>: </span>}
      <span className="json-string">{String(value)}</span>
    </div>
  )
}
