import React from 'react'
import type { RequestDiffPayload } from '../../types/protocol'

interface RequestDiffViewProps {
  diff: RequestDiffPayload
}

export function RequestDiffView({ diff }: RequestDiffViewProps) {
  const hasChanges = diff.bodyDiff.some(l => l.type !== 'unchanged') ||
                     diff.headersDiff.some(l => l.type !== 'unchanged') ||
                     diff.statusChanged

  if (!hasChanges) {
    return (
      <div style={{
        padding: 12,
        color: 'var(--color-text-muted)',
        fontSize: 12,
        fontFamily: 'var(--font-mono)',
      }}>
        ✓ Sem alterações em relação à chamada anterior
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      {diff.statusChanged && (
        <div style={{
          padding: '6px 10px',
          background: 'rgba(234, 179, 8, 0.12)',
          borderRadius: 6,
          fontSize: 12,
          color: '#EAB308',
          fontFamily: 'var(--font-mono)',
        }}>
          ⚠ Status alterado: <strong>{diff.previousStatus}</strong> → novo status
        </div>
      )}

      {diff.durationDelta !== undefined && Math.abs(diff.durationDelta) > 100 && (
        <div style={{
          padding: '6px 10px',
          background: diff.durationDelta > 0 ? 'rgba(234, 179, 8, 0.12)' : 'rgba(34, 197, 94, 0.12)',
          borderRadius: 6,
          fontSize: 12,
          color: diff.durationDelta > 0 ? '#EAB308' : '#22C55E',
          fontFamily: 'var(--font-mono)',
        }}>
          {diff.durationDelta > 0
            ? `↑ ${diff.durationDelta}ms mais lento que a chamada anterior`
            : `↓ ${Math.abs(diff.durationDelta)}ms mais rápido que a chamada anterior`
          }
        </div>
      )}

      {diff.bodyDiff.some(l => l.type !== 'unchanged') && (
        <DiffSection title="Body" lines={diff.bodyDiff} />
      )}

      {diff.headersDiff.some(l => l.type !== 'unchanged') && (
        <DiffSection title="Headers" lines={diff.headersDiff} />
      )}
    </div>
  )
}

function DiffSection({ title, lines }: {
  title: string
  lines: RequestDiffPayload['bodyDiff']
}) {
  return (
    <div>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--color-text-muted)',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
      }}>
        {title}
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 12,
        borderRadius: 6,
        overflow: 'auto',
        border: '1px solid var(--border-color)',
        maxHeight: 300,
      }}>
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              padding: '2px 8px',
              background: line.type === 'added'
                ? 'rgba(74, 222, 128, 0.08)'
                : line.type === 'removed'
                ? 'rgba(248, 113, 113, 0.08)'
                : 'transparent',
              color: line.type === 'added'
                ? '#4ADE80'
                : line.type === 'removed'
                ? '#F87171'
                : 'var(--color-text)',
              display: 'flex',
              gap: 8,
              lineHeight: 1.6,
            }}
          >
            <span style={{ userSelect: 'none', opacity: 0.5, minWidth: 16 }}>
              {line.type === 'added' ? '+' : line.type === 'removed' ? '−' : ' '}
            </span>
            {line.key && (
              <span style={{ opacity: 0.7 }}>{line.key}:</span>
            )}
            <span>{line.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
