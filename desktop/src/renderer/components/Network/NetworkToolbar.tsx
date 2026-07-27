import React from 'react'
import { Ban } from 'lucide-react'
import { FilterChips } from '../shared/FilterChips'
import { SearchInput } from '../shared/SearchInput'
import { HTTP_METHODS, STATUS_FILTERS } from '../../utils/constants'
import { useNetworkStore } from '../../stores/networkStore'
import { MethodFilter, StatusFilter } from '../../types/network'

export const NetworkToolbar: React.FC = () => {
  const { filter, setMethodFilter, setStatusFilter, setSearch, setOnlyErrors, clearRequests } = useNetworkStore()

  const methodChips = HTTP_METHODS.map((m) => ({ label: m, value: m }))
  const statusChips = STATUS_FILTERS.map((s) => ({ label: s, value: s }))

  return (
    <div className="toolbar" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        <FilterChips
          chips={methodChips}
          activeValues={filter.method}
          onChange={(v) => setMethodFilter(v as MethodFilter)}
        />
        
        <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />
        
        <FilterChips
          chips={statusChips}
          activeValues={filter.status}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />

        <div style={{ width: 1, height: 16, background: 'var(--border-color)' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={filter.onlyErrors}
            onChange={(e) => setOnlyErrors(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Apenas Erros
        </label>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <SearchInput
          id="network-search-input"
          value={filter.search}
          onChange={setSearch}
          placeholder="Filtrar URLs..."
        />
        <button className="btn btn-icon" onClick={clearRequests} title="Limpar Rede" style={{ opacity: 0.6 }}>
          <Ban size={16} />
        </button>
      </div>
    </div>
  )
}
