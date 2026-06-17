import React, { useState } from 'react'
import { ConsoleLogEntry } from '../../types/console'
import { formatTimestamp, getLogLevelColor, getLogLevelBg } from '../../utils/formatters'
import { JsonViewer } from '../shared/JsonViewer'

interface LogRowProps {
  log: ConsoleLogEntry
}

const getLevelIcon = (level: string) => {
  switch (level) {
    case 'info': return 'ℹ️'
    case 'warn': return '⚠️'
    case 'error': return '❌'
    case 'table': return '📊'
    default: return ''
  }
}

export const LogRow: React.FC<LogRowProps> = ({ log }) => {
  const [showStack, setShowStack] = useState(false)
  
  const color = getLogLevelColor(log.level)
  const bg = getLogLevelBg(log.level)
  const icon = getLevelIcon(log.level)

  return (
    <div className={`log-row log-row-${log.level}`} style={{ position: 'relative' }}>
      <div className="log-border" style={{ background: color }} />
      
      <div className="log-timestamp">{formatTimestamp(log.timestamp)}</div>
      
      {icon && <div className="log-level-icon">{icon}</div>}
      
      <div className="log-content" style={{ color: log.level === 'error' ? 'var(--color-error)' : log.level === 'warn' ? 'var(--color-warning)' : 'inherit' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {log.args.map((arg, idx) => {
            if (arg.type === 'string' || arg.type === 'number' || arg.type === 'boolean' || arg.type === 'null' || arg.type === 'undefined') {
              return <span key={idx}>{String(arg.value)}</span>
            }
            if (arg.type === 'error') {
              return <span key={idx} style={{ color: 'var(--color-error)' }}>{String(arg.value)}</span>
            }
            if (arg.type === 'function' || arg.type === 'symbol') {
              return <span key={idx} style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>{String(arg.value)}</span>
            }
            // Object or array
            if (arg.preview) {
              return (
                <div key={idx} style={{ width: '100%' }}>
                  <JsonViewer data={arg.value} initialExpanded={false} />
                </div>
              )
            }
            return (
              <div key={idx} style={{ width: '100%' }}>
                <JsonViewer data={arg.value} initialExpanded={false} />
              </div>
            )
          })}
        </div>

        {log.stackTrace && (
          <div style={{ marginTop: 4 }}>
            <span 
              style={{ fontSize: 11, color: 'var(--color-text-muted)', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => setShowStack(!showStack)}
            >
              {showStack ? 'Hide Stack Trace' : 'Show Stack Trace'}
            </span>
            {showStack && (
              <div className="log-stack">
                {log.stackTrace}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
