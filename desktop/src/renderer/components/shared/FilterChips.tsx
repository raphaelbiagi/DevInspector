import React from 'react'

interface FilterChip {
  label: string
  value: string
  count?: number
}

interface FilterChipsProps {
  chips: FilterChip[]
  activeValues: Set<string> | string
  onChange: (value: string) => void
  mode?: 'single' | 'multi'
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  chips,
  activeValues,
  onChange,
  mode = 'single'
}) => {
  const isActive = (value: string): boolean => {
    if (mode === 'single') return activeValues === value
    return (activeValues as Set<string>).has(value)
  }

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {chips.map((chip) => (
        <button
          key={chip.value}
          className={`chip ${isActive(chip.value) ? 'active' : ''}`}
          onClick={() => onChange(chip.value)}
        >
          {chip.label}
          {chip.count !== undefined && chip.count > 0 && (
            <span className="chip-count">{chip.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
