import React, { useState } from 'react'
import { Smartphone, Cpu, Bug } from 'lucide-react'
import { useConnectionStore } from '../../stores/connectionStore'

export const Header: React.FC = () => {
  const { connected, clientInfo } = useConnectionStore()
  const [inAppUiEnabled, setInAppUiEnabled] = useState(false)

  return (
    <div className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 'var(--header-height)', padding: '0 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', userSelect: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 14, color: '#fff', letterSpacing: 0.5 }}>
          <Bug size={18} color="var(--color-accent)" />
          DevInspector
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 16, background: connected ? 'var(--color-success-bg)' : 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--color-success)' : 'var(--color-text-muted)' }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: connected ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            {connected ? 'Conectado' : 'Offline'}
          </span>
        </div>

        {connected && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 12, background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontWeight: 500 }}>UI In-App</span>
            <button
              onClick={() => {
                const newState = !inAppUiEnabled
                setInAppUiEnabled(newState)
                window.devInspector?.toggleFloatingDebugger?.(newState)
              }}
              style={{
                width: 32,
                height: 18,
                borderRadius: 10,
                background: inAppUiEnabled ? 'var(--color-accent)' : 'var(--bg-tertiary)',
                border: 'none',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: '#fff',
                position: 'absolute',
                top: 2,
                left: inAppUiEnabled ? 16 : 2,
                transition: 'left 0.2s',
                boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
              }} />
            </button>
          </div>
        )}
      </div>

      {connected && clientInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--color-text-secondary)', background: 'var(--bg-primary)', padding: '4px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Smartphone size={14} />
            <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{clientInfo.appName}</span>
          </div>
          <div style={{ width: 1, height: 12, background: 'var(--border-color)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Cpu size={14} />
            <span style={{ color: 'var(--color-text)', fontWeight: 500, textTransform: 'capitalize' }}>{clientInfo.platform}</span>
          </div>
        </div>
      )}
    </div>
  )
}
