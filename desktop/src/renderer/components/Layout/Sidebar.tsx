import React from 'react'
import { Network, TerminalSquare, Activity, Database, Trash2, Download } from 'lucide-react'
import { TAB_NETWORK, TAB_CONSOLE, TAB_INSIGHTS, TAB_DATABASE, TabId } from '../../utils/constants'
import { useConsoleStore } from '../../stores/consoleStore'
import { useTimelineStore } from '../../stores/timelineStore'

interface SidebarProps {
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  onClear: () => void
  onExport: (format: 'json' | 'har') => void
}

const exportItemStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '10px 14px',
  background: 'transparent',
  border: 'none',
  color: 'var(--color-text)',
  cursor: 'pointer',
  fontSize: 13
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onTabChange,
  onClear,
  onExport
}) => {
  const [exportMenuOpen, setExportMenuOpen] = React.useState(false)
  const exportMenuRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!exportMenuOpen) return

    const handlePointerDown = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) {
        setExportMenuOpen(false)
      }
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [exportMenuOpen])

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
            title="Insights"
            className={`sidebar-btn ${activeTab === TAB_INSIGHTS ? 'active' : ''}`}
            onClick={() => onTabChange(TAB_INSIGHTS)}
            style={{ border: 'none', background: activeTab === TAB_INSIGHTS ? 'var(--bg-active)' : 'transparent', padding: 12, borderRadius: 'var(--radius-md)', cursor: 'pointer', opacity: activeTab === TAB_INSIGHTS ? 1 : 0.5, transition: 'all 0.2s' }}
          >
            <Activity size={22} color={activeTab === TAB_INSIGHTS ? 'var(--color-accent)' : 'var(--color-text)'} strokeWidth={2} />
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

        <div className="tooltip-wrapper" style={{ position: 'relative' }} ref={exportMenuRef}>
          <button
            title="Exportar Sessão"
            className="sidebar-btn"
            onClick={() => setExportMenuOpen(open => !open)}
            style={{ border: 'none', background: exportMenuOpen ? 'var(--bg-active)' : 'transparent', padding: 12, cursor: 'pointer', opacity: exportMenuOpen ? 1 : 0.5, borderRadius: 'var(--radius-md)', transition: 'all 0.2s' }}
          >
            <Download size={20} color="var(--color-text)" />
          </button>

          {exportMenuOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: '100%',
                marginLeft: 8,
                zIndex: 1000,
                minWidth: 220,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden'
              }}
            >
              <button
                className="export-menu-item"
                onClick={() => { setExportMenuOpen(false); onExport('json') }}
                style={exportItemStyle}
              >
                <div style={{ fontWeight: 600 }}>Exportar JSON</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Rede, console e anomalias
                </div>
              </button>
              <button
                className="export-menu-item"
                onClick={() => { setExportMenuOpen(false); onExport('har') }}
                style={{ ...exportItemStyle, borderTop: '1px solid var(--border-color)' }}
              >
                <div style={{ fontWeight: 600 }}>Exportar HAR</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Abre no Chrome DevTools, Insomnia, Postman
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
