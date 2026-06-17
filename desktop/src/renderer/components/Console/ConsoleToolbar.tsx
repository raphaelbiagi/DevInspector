import React from 'react'
import { Ban } from 'lucide-react'
import { FilterChips } from '../shared/FilterChips'
import { SearchInput } from '../shared/SearchInput'
import { LOG_LEVELS } from '../../utils/constants'
import { useConsoleStore } from '../../stores/consoleStore'
import { LogLevel } from '../../types/console'

export const ConsoleToolbar: React.FC = () => {
  const { filter, toggleLevel, setSearch, clearLogs, getLevelCounts } = useConsoleStore()
  const counts = getLevelCounts()

  const levelChips = LOG_LEVELS.map((level) => ({
    label: level.toUpperCase(),
    value: level,
    count: counts[level]
  }))

  return (
    <div className="toolbar" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <FilterChips
          mode="multi"
          chips={levelChips}
          activeValues={filter.levels}
          onChange={(v) => toggleLevel(v as LogLevel)}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <SearchInput
          value={filter.search}
          onChange={setSearch}
          placeholder="Filtrar logs..."
        />
        <button className="btn btn-icon" onClick={clearLogs} title="Limpar Console" style={{ opacity: 0.6 }}>
          <Ban size={16} />
        </button>
      </div>
    </div>
  )
}
