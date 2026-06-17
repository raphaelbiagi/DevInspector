import React from 'react'
import { Network, TerminalSquare, Activity, Database, Trash2, Download } from 'lucide-react'
import { TAB_NETWORK, TAB_CONSOLE, TAB_TIMELINE, TAB_DATABASE, TabId } from '../../utils/constants'
import { useConsoleStore } from '../../stores/consoleStore'
import { useTimelineStore } from '../../stores/timelineStore'

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onClear: () => void
  onExport: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onTabChange, 
  onClear,
  onExport
}) => {
  const errorCount = useConsoleStore((state) => state.getErrorCount())
  const anomalyCount = useTimelineStore((state) =>
    state.items.filter(i => i.type === 'anomaly').length
  )

  return (
    <div className="app-sidebar" style={{ paddingTop: 16 }}>
      <div className="sidebar-nav" style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', gap: 12 }}>
        
        <div className="tooltip-wrapper" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
          <button
            title="Inspetor de Rede"
            className={`sidebar-btn ${activeTab === TAB_NETWORK ? 'active' : ''}`}
            onClick={() => onTabChange(TAB_NETWORK)}
            style={{ border: 'none', background: activeTab === TAB_NETWORK ? 'var(--bg-active)' : 'transparent', padding: 12, borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: activeTab === TAB_NETWORK ? 1 : 0.5, transition: 'all 0.2s' }}
          >
            <Network size={22} color={activeTab === TAB_NETWORK ? 'var(--color-accent)' : 'var(--color-text)'} strokeWidth={2} />
          </button>
        </div>

        <div className="tooltip-wrapper" style={{ width: '100%', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <button
            title="Console de Logs"
            className={`sidebar-btn ${activeTab === TAB_CONSOLE ? 'active' : ''}`}
            onClick={() => onTabChange(TAB_CONSOLE)}
            style={{ border: 'none', background: activeTab === TAB_CONSOLE ? 'var(--bg-active)' : 'transparent', padding: 12, borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: activeTab === TAB_CONSOLE ? 1 : 0.5, transition: 'all 0.2s' }}
          >
            <TerminalSquare size={22} color={activeTab === TAB_CONSOLE ? 'var(--color-accent)' : 'var(--color-text)'} strokeWidth={2} />
            {errorCount > 0 && <span className="sidebar-badge" style={{ position: 'absolute', top: 4, right: 8, background: 'var(--color-error)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 'bold' }}>{errorCount > 99 ? '99+' : errorCount}</span>}
          </button>
        </div>

        <div className="tooltip-wrapper" style={{ width: '100%', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <button
            title="Timeline em Cascata"
            className={`sidebar-btn ${activeTab === TAB_TIMELINE ? 'active' : ''}`}
            onClick={() => onTabChange(TAB_TIMELINE)}
            style={{ border: 'none', background: activeTab === TAB_TIMELINE ? 'var(--bg-active)' : 'transparent', padding: 12, borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: activeTab === TAB_TIMELINE ? 1 : 0.5, transition: 'all 0.2s' }}
          >
            <Activity size={22} color={activeTab === TAB_TIMELINE ? 'var(--color-accent)' : 'var(--color-text)'} strokeWidth={2} />
            {anomalyCount > 0 && <span className="sidebar-badge" style={{ position: 'absolute', top: 4, right: 8, background: 'var(--color-warning)', color: '#fff', fontSize: 10, padding: '2px 6px', borderRadius: 10, fontWeight: 'bold' }}>{anomalyCount > 99 ? '99+' : anomalyCount}</span>}
          </button>
        </div>

        <div className="tooltip-wrapper" style={{ width: '100%', display: 'flex', justifyContent: 'center', position: 'relative' }}>
          <button
            title="Inspetor de Banco de Dados"
            className={`sidebar-btn ${activeTab === TAB_DATABASE ? 'active' : ''}`}
            onClick={() => onTabChange(TAB_DATABASE)}
            style={{ border: 'none', background: activeTab === TAB_DATABASE ? 'var(--bg-active)' : 'transparent', padding: 12, borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: activeTab === TAB_DATABASE ? 1 : 0.5, transition: 'all 0.2s' }}
          >
            <Database size={22} color={activeTab === TAB_DATABASE ? 'var(--color-accent)' : 'var(--color-text)'} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className="sidebar-bottom" style={{ display: 'flex', flexDirection: 'column', width: '100%', alignItems: 'center', gap: 12, paddingBottom: 16 }}>
        <div className="tooltip-wrapper">
          <button 
            title="Limpar Aba Atual"
            className="sidebar-btn" 
            onClick={onClear}
            style={{ border: 'none', background: 'transparent', padding: 12, cursor: 'pointer', opacity: 0.5, transition: 'all 0.2s' }}
          >
            <Trash2 size={20} color="var(--color-text)" />
          </button>
        </div>

        <div className="tooltip-wrapper">
          <button 
            title="Exportar Sessão"
            className="sidebar-btn" 
            onClick={onExport}
            style={{ border: 'none', background: 'transparent', padding: 12, cursor: 'pointer', opacity: 0.5, transition: 'all 0.2s' }}
          >
            <Download size={20} color="var(--color-text)" />
          </button>
        </div>
      </div>
    </div>
  )
}
