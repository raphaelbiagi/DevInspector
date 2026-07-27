import React, { useState } from 'react'
import { AlertCircle, X } from 'lucide-react'
import { Header } from './components/Layout/Header'
import { Sidebar } from './components/Layout/Sidebar'
import { StatusBar } from './components/Layout/StatusBar'
import { NetworkPanel } from './components/Network/NetworkPanel'
import { ConsolePanel } from './components/Console/ConsolePanel'
import { InsightsPanel } from './components/Timeline/index'
import { useSocketListener } from './hooks/useSocket'
import { useExport } from './hooks/useExport'
import { useNetworkStore } from './stores/networkStore'
import { useConsoleStore } from './stores/consoleStore'
import { useTimelineStore } from './stores/timelineStore'
import { useConnectionStore } from './stores/connectionStore'
import { TAB_NETWORK, TAB_CONSOLE, TAB_INSIGHTS, TAB_DATABASE, TabId } from './utils/constants'
import { DatabasePanel } from './components/Database/DatabasePanel'
import { CommandPalette } from './components/shared/CommandPalette'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(TAB_NETWORK)
  const { handleExport } = useExport()
  const clearNetwork = useNetworkStore(state => state.clearRequests)
  const clearConsole = useConsoleStore(state => state.clearLogs)
  const clearInsights = useTimelineStore(state => state.clearAll)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [toast, setToast] = useState<{ title: string, message: string } | null>(null)

  // Initialize IPC listeners
  useSocketListener()

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input (except if Cmd+K)
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsCommandPaletteOpen(prev => !prev)
      } else if (e.key === '/' && !isInput) {
        e.preventDefault()
        if (activeTab !== TAB_NETWORK) {
          setActiveTab(TAB_NETWORK)
        }
        setTimeout(() => {
          const searchInput = document.getElementById('network-search-input')
          if (searchInput) searchInput.focus()
        }, 50)
      }
    }
    
    window.addEventListener('keydown', handleGlobalKeyDown)
    
    const handleToast = (e: any) => {
      setToast(e.detail)
      setTimeout(() => setToast(null), 5000)
    }
    window.addEventListener('devinspector:toast', handleToast)

    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
      window.removeEventListener('devinspector:toast', handleToast)
    }
  }, [activeTab])

  const handleClear = () => {
    if (activeTab === TAB_NETWORK) clearNetwork()
    if (activeTab === TAB_CONSOLE) clearConsole()
    if (activeTab === TAB_INSIGHTS) clearInsights()
    // also clear client-side buffer
    if (window.devInspector) {
      window.devInspector.clearClientLogs()
    }
  }

  const connected = useConnectionStore(state => state.connected)

  return (
    <div className="app-layout animate-fade-in">
      <Sidebar 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        onClear={handleClear}
        onExport={handleExport}
      />
      
      <div className="app-main" style={{ position: 'relative' }}>
        <Header />
        
        <div className="app-content">
          {activeTab === TAB_NETWORK && (
            <div style={{ height: '100%' }}>
              <NetworkPanel />
            </div>
          )}
          
          {activeTab === TAB_CONSOLE && (
            <div style={{ height: '100%' }}>
              <ConsolePanel />
            </div>
          )}

          {activeTab === TAB_INSIGHTS && (
            <div className="tab-content active" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <InsightsPanel onNavigateToNetwork={() => setActiveTab(TAB_NETWORK)} />
            </div>
          )}

          {activeTab === TAB_DATABASE && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <DatabasePanel />
            </div>
          )}
        </div>

        {!connected && (
          <div className="loading-overlay animate-fade-in">
            <div className="loading-card">
              <svg className="lucide-spinner animate-spin" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
              </svg>
              <h2 style={{ marginTop: 16, fontSize: 16, fontWeight: 600, color: 'var(--color-text-bright)' }}>Aguardando conexão com o App...</h2>
              <p style={{ marginTop: 8, fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', maxWidth: 280 }}>
                Se você acabou de desconectar o cabo USB, aguarde alguns segundos para que a conexão via Wi-Fi seja restabelecida automaticamente.
              </p>
            </div>
          </div>
        )}

        <StatusBar />
        
        {toast && (
          <div className="animate-slide-in" style={{
            position: 'absolute', top: 16, right: 16, zIndex: 9999,
            background: 'var(--bg-surface)', border: '1px solid var(--color-warning)',
            boxShadow: 'var(--shadow-lg), 0 0 20px rgba(245, 158, 11, 0.2)',
            borderRadius: 'var(--radius-md)', padding: '12px 16px',
            display: 'flex', gap: 12, alignItems: 'flex-start', maxWidth: 350
          }}>
            <AlertCircle size={18} style={{ color: 'var(--color-warning)', marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--color-text-bright)' }}>{toast.title}</div>
              <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{toast.message}</div>
            </div>
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', marginLeft: 8 }}>
              <X size={14} />
            </button>
          </div>
        )}

        <CommandPalette 
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          onSelectTab={setActiveTab}
          onClearNetwork={clearNetwork}
          onClearConsole={clearConsole}
          onClearInsights={clearInsights}
        />
      </div>
    </div>
  )
}

export default App
