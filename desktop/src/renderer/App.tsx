import React, { useState } from 'react'
import { Header } from './components/Layout/Header'
import { Sidebar } from './components/Layout/Sidebar'
import { StatusBar } from './components/Layout/StatusBar'
import { NetworkPanel } from './components/Network/NetworkPanel'
import { ConsolePanel } from './components/Console/ConsolePanel'
import { TimelinePanel } from './components/Timeline/index'
import { useSocketListener } from './hooks/useSocket'
import { useExport } from './hooks/useExport'
import { useNetworkStore } from './stores/networkStore'
import { useConsoleStore } from './stores/consoleStore'
import { useTimelineStore } from './stores/timelineStore'
import { useConnectionStore } from './stores/connectionStore'
import { TAB_NETWORK, TAB_CONSOLE, TAB_TIMELINE, TAB_DATABASE, TabId } from './utils/constants'
import { DatabasePanel } from './components/Database/DatabasePanel'

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>(TAB_NETWORK)
  const { handleExport } = useExport()
  const clearNetwork = useNetworkStore(state => state.clearRequests)
  const clearConsole = useConsoleStore(state => state.clearLogs)
  const clearTimeline = useTimelineStore(state => state.clearAll)

  // Initialize IPC listeners
  useSocketListener()

  const handleClear = () => {
    if (activeTab === TAB_NETWORK) clearNetwork()
    if (activeTab === TAB_CONSOLE) clearConsole()
    if (activeTab === TAB_TIMELINE) clearTimeline()
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

          {activeTab === TAB_TIMELINE && (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <TimelinePanel />
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
      </div>
    </div>
  )
}

export default App
