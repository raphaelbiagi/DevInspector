import React, { useState, useEffect, useRef } from 'react'
import { Search, Terminal, Activity, Database, Network, Trash2, X } from 'lucide-react'
import { TAB_NETWORK, TAB_CONSOLE, TAB_INSIGHTS, TAB_DATABASE, TabId } from '../../utils/constants'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectTab: (tab: TabId) => void
  onClearNetwork: () => void
  onClearConsole: () => void
  onClearInsights: () => void
}

interface Command {
  id: string
  label: string
  icon: React.ReactNode
  action: () => void
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectTab,
  onClearNetwork,
  onClearConsole,
  onClearInsights
}) => {
  const [search, setSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const commands: Command[] = [
    { id: 'tab-network', label: 'Ir para Network', icon: <Network size={16} />, action: () => onSelectTab(TAB_NETWORK) },
    { id: 'tab-console', label: 'Ir para Console', icon: <Terminal size={16} />, action: () => onSelectTab(TAB_CONSOLE) },
    { id: 'tab-insights', label: 'Ir para Insights', icon: <Activity size={16} />, action: () => onSelectTab(TAB_INSIGHTS) },
    { id: 'tab-database', label: 'Ir para Banco de Dados', icon: <Database size={16} />, action: () => onSelectTab(TAB_DATABASE) },
    { id: 'clear-network', label: 'Limpar Rede', icon: <Trash2 size={16} />, action: onClearNetwork },
    { id: 'clear-console', label: 'Limpar Console', icon: <Trash2 size={16} />, action: onClearConsole },
    { id: 'clear-insights', label: 'Limpar Insights', icon: <Trash2 size={16} />, action: onClearInsights }
  ]

  const filteredCommands = commands.filter(c => c.label.toLowerCase().includes(search.toLowerCase()))

  useEffect(() => {
    if (isOpen) {
      setSearch('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return
      if (e.key === 'Escape') {
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % (filteredCommands.length || 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && isOpen) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, isOpen])

  if (!isOpen) return null

  return (
    <div 
      className="loading-overlay animate-fade-in" 
      style={{ zIndex: 9999, alignItems: 'flex-start', paddingTop: '15vh' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div 
        className="command-palette-card"
        style={{ 
          width: 500, 
          background: 'var(--bg-surface)', 
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg), 0 0 40px rgba(0,0,0,0.5)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
          <Search size={18} style={{ color: 'var(--color-text-muted)', marginRight: 12 }} />
          <input 
            ref={inputRef}
            type="text" 
            placeholder="Digite um comando..." 
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setSelectedIndex(0)
            }}
            style={{ 
              flex: 1, 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--color-text)', 
              fontSize: 14, 
              outline: 'none' 
            }}
          />
          <button className="btn-icon" onClick={onClose} style={{ color: 'var(--color-text-muted)' }}>
            <X size={16} />
          </button>
        </div>
        <div ref={listRef} style={{ maxHeight: 300, overflowY: 'auto', padding: 8 }}>
          {filteredCommands.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>
              Nenhum comando encontrado
            </div>
          ) : (
             filteredCommands.map((cmd, i) => (
              <div 
                key={cmd.id}
                onClick={() => {
                  cmd.action()
                  onClose()
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 12, 
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  background: i === selectedIndex ? 'var(--color-accent)' : 'transparent',
                  color: i === selectedIndex ? '#fff' : 'var(--color-text)'
                }}
              >
                <div style={{ color: i === selectedIndex ? '#fff' : 'var(--color-text-muted)' }}>
                  {cmd.icon}
                </div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>
                  {cmd.label}
                </div>
              </div>
            ))
          )}
        </div>
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-color)', fontSize: 11, color: 'var(--color-text-muted)', display: 'flex', justifyContent: 'space-between' }}>
          <span>Navegue com ↑/↓ e Enter para selecionar</span>
          <span>Esc para fechar</span>
        </div>
      </div>
    </div>
  )
}
