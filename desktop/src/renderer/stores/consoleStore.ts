import { create } from 'zustand'
import type { ConsoleLogEntry, LogLevel } from '../types/console'
import { MAX_CONSOLE_LOGS } from '../utils/constants'

interface ConsoleState {
  logs: ConsoleLogEntry[]
  filter: {
    levels: Set<LogLevel>
    search: string
  }

  // Actions
  addLog: (entry: ConsoleLogEntry) => void
  clearLogs: () => void
  toggleLevel: (level: LogLevel) => void
  setAllLevels: () => void
  setSearch: (search: string) => void

  // Derived
  getFilteredLogs: () => ConsoleLogEntry[]
  getLevelCounts: () => Record<LogLevel, number>
  getErrorCount: () => number
}

const ALL_LEVELS = new Set<LogLevel>(['log', 'info', 'warn', 'error', 'table'])

export const useConsoleStore = create<ConsoleState>((set, get) => ({
  logs: [],
  filter: {
    levels: new Set(ALL_LEVELS),
    search: ''
  },

  addLog: (entry) => {
    set((state) => {
      let logs = [...state.logs, entry]
      // FIFO cleanup
      if (logs.length > MAX_CONSOLE_LOGS) {
        logs = logs.slice(logs.length - MAX_CONSOLE_LOGS)
      }
      return { logs }
    })
  },

  clearLogs: () => set({ logs: [] }),

  toggleLevel: (level) => {
    set((state) => {
      const levels = new Set(state.filter.levels)
      if (levels.has(level)) {
        levels.delete(level)
      } else {
        levels.add(level)
      }
      return { filter: { ...state.filter, levels } }
    })
  },

  setAllLevels: () => {
    set((state) => ({
      filter: { ...state.filter, levels: new Set(ALL_LEVELS) }
    }))
  },

  setSearch: (search) =>
    set((state) => ({ filter: { ...state.filter, search } })),

  getFilteredLogs: () => {
    const { logs, filter } = get()
    let result = logs

    if (filter.levels.size < ALL_LEVELS.size) {
      result = result.filter((l) => filter.levels.has(l.level))
    }

    if (filter.search) {
      const s = filter.search.toLowerCase()
      result = result.filter((l) => {
        const argsStr = l.args
          .map((a) => {
            if (typeof a.value === 'string') return a.value
            if (a.preview) return a.preview
            return JSON.stringify(a.value)
          })
          .join(' ')
        return argsStr.toLowerCase().includes(s)
      })
    }

    return result
  },

  getLevelCounts: () => {
    const logs = get().logs
    const counts: Record<LogLevel, number> = {
      log: 0,
      info: 0,
      warn: 0,
      error: 0,
      table: 0
    }
    for (const l of logs) {
      counts[l.level]++
    }
    return counts
  },

  getErrorCount: () => {
    return get().logs.filter((l) => l.level === 'error').length
  }
}))
