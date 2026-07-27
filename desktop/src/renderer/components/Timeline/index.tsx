import React, { useMemo } from 'react'
import { AlertCircle, Clock, HardDrive, Cpu, Layers } from 'lucide-react'
import { useTimelineStore } from '../../stores/timelineStore'
import { useNetworkStore } from '../../stores/networkStore'
import type { AnomalyPayload } from '../../types/protocol'

export function InsightsPanel({ onNavigateToNetwork }: { onNavigateToNetwork: () => void }) {
  const anomalies = useTimelineStore(state => state.anomalies)
  const selectRequest = useNetworkStore(state => state.selectRequest)

  // Sort by timestamp desc
  const sortedAnomalies = useMemo(() => {
    return [...anomalies].sort((a, b) => b.timestamp - a.timestamp)
  }, [anomalies])

  const criticalCount = anomalies.filter(a => a.severity === 'critical').length
  const warningCount = anomalies.filter(a => a.severity === 'warning').length

  const getIcon = (type: string) => {
    switch(type) {
      case 'slow_request': return <Clock size={16} />
      case 'large_response': return <HardDrive size={16} />
      case 'error_status': return <AlertCircle size={16} />
      case 'console_flood': return <Cpu size={16} />
      default: return <Layers size={16} />
    }
  }

  const formatTimestamp = (ts: number) => {
    const d = new Date(ts)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
  }

  if (anomalies.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" style={{ opacity: 0.5 }}>✨</div>
        <div>Tudo Limpo!</div>
        <div className="empty-subtitle">
          Nenhuma anomalia de performance ou erro recorrente detectado.
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, height: '100%', overflowY: 'auto' }}>
      <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24, color: 'var(--color-text-bright)' }}>Insights & Anomalias</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>Total de Anomalias</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text-bright)' }}>{anomalies.length}</div>
        </div>
        <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-warning)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-warning)', marginBottom: 8 }}>Avisos (Warnings)</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-warning)' }}>{warningCount}</div>
        </div>
        <div style={{ padding: 16, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-error)' }}>
          <div style={{ fontSize: 13, color: 'var(--color-error)', marginBottom: 8 }}>Críticos</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-error)' }}>{criticalCount}</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sortedAnomalies.map(a => (
          <div key={a.id} style={{ 
            display: 'flex', gap: 16, padding: 16, 
            background: 'var(--bg-elevated)', 
            borderRadius: 'var(--radius-md)', 
            borderLeft: `4px solid ${a.severity === 'critical' ? 'var(--color-error)' : 'var(--color-warning)'}`
          }}>
            <div style={{ color: a.severity === 'critical' ? 'var(--color-error)' : 'var(--color-warning)', marginTop: 2 }}>
              {getIcon(a.type)}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: 'var(--color-text-bright)' }}>
                  {a.type === 'slow_request' && 'Requisição Lenta'}
                  {a.type === 'large_response' && 'Payload Gigante'}
                  {a.type === 'error_status' && 'Erro de Rede (5xx/4xx)'}
                  {a.type === 'console_flood' && 'Flood no Console'}
                  {a.type === 'repeated_error' && 'Erro Repetido'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{formatTimestamp(a.timestamp)}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{a.description}</div>
              
              {(a.type === 'slow_request' || a.type === 'large_response' || a.type === 'error_status') && (
                <button 
                  onClick={() => {
                    selectRequest(a.relatedId)
                    onNavigateToNetwork()
                  }}
                  className="btn" 
                  style={{ marginTop: 12, fontSize: 12, padding: '4px 12px' }}
                >
                  Ver no Network
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
