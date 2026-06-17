import React from 'react'
import { Search } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}

export const SearchInput: React.FC<SearchInputProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Search...' 
}) => {
  return (
    <div className="search-input-wrapper">
      <div className="search-icon" style={{ display: 'flex', alignItems: 'center', left: 10 }}>
        <Search size={14} />
      </div>
      <input
        type="text"
        className="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button 
          className="search-clear" 
          onClick={() => onChange('')}
          title="Clear search"
        >
          ×
        </button>
      )}
    </div>
  )
}
