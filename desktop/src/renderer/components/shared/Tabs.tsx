import React from 'react'

interface Tab {
  id: string
  label: string
  badge?: number
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange: (id: string) => void
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="tabs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 10,
                background: 'var(--color-error)',
                color: '#fff',
                padding: '0 5px',
                borderRadius: 8,
                fontWeight: 700
              }}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
