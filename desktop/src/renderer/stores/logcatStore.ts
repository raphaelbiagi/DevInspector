import { create } from 'zustand'
import type { LogcatDevice, LogcatEntry, LogcatLevel, LogcatStatus } from '../types/logcat'
import { MAX_LOGCAT_ENTRIES } from '../utils/constants'
import { filterLogcatEntries, LOGCAT_LEVELS } from '../utils/logcatFilter'

interface LogcatState {
  entries: LogcatEntry[]
  status: LogcatStatus
  devices: LogcatDevice[]
  devicesError: string | null
  packages: string[]
  selectedSerial: string | null
  /** '' = todos os processos */
  packageName: string
  filter: {
    levels: Set<LogcatLevel>
    search: string
  }
  sortOrder: LogcatSortOrder

  addEntries: (batch: LogcatEntry[]) => void
  clear: () => void
  setStatus: (status: LogcatStatus) => void
  refreshDevices: () => Promise<void>
  selectDevice: (serial: string | null) => void
  setPackageName: (packageName: string) => void
  toggleLevel: (level: LogcatLevel) => void
  setAllLevels: () => void
  setSearch: (search: string) => void
  setSortOrder: (order: LogcatSortOrder) => void
  start: () => Promise<void>
  stop: () => Promise<void>

  getFilteredEntries: () => LogcatEntry[]
  getLevelCounts: () => Record<LogcatLevel, number>
}

export type LogcatSortOrder = 'asc' | 'desc'

// Por data/hora; o id desempata linhas no mesmo milissegundo mantendo a ordem de chegada.
const byTime = (a: LogcatEntry, b: LogcatEntry) => a.timestamp - b.timestamp || a.id - b.id

const IDLE_STATUS: LogcatStatus = { running: false, serial: null, packageName: null, pids: [], error: null }

export const useLogcatStore = create<LogcatState>((set, get) => ({
  entries: [],
  status: IDLE_STATUS,
  devices: [],
  devicesError: null,
  packages: [],
  selectedSerial: null,
  packageName: '',
  filter: {
    levels: new Set(LOGCAT_LEVELS),
    search: ''
  },
  sortOrder: 'asc',

  addEntries: (batch) => {
    if (batch.length === 0) return
    set((state) => {
      let entries = state.entries.concat(batch)
      // O logcat intercala buffers (main, system, crash) e pode entregar linhas
      // levemente fora de ordem. Só ordena quando precisa — o caso comum já
      // chega em ordem e não paga o sort a cada lote.
      const prevLast = state.entries[state.entries.length - 1]
      const outOfOrder =
        (prevLast && byTime(batch[0], prevLast) < 0) ||
        batch.some((e, i) => i > 0 && byTime(e, batch[i - 1]) < 0)
      if (outOfOrder) entries.sort(byTime)
      // FIFO cleanup
      if (entries.length > MAX_LOGCAT_ENTRIES) {
        entries = entries.slice(entries.length - MAX_LOGCAT_ENTRIES)
      }
      return { entries }
    })
  },

  clear: () => set({ entries: [] }),

  setStatus: (status) => set({ status }),

  refreshDevices: async () => {
    if (!window.devInspector) return
    const { devices, error } = await window.devInspector.logcatListDevices()
    const current = get().selectedSerial
    const stillThere = devices.some((d) => d.serial === current)
    const selectedSerial = stillThere ? current : devices.find((d) => d.state === 'device')?.serial ?? null
    set({ devices, devicesError: error })
    if (selectedSerial !== current) get().selectDevice(selectedSerial)
  },

  selectDevice: (serial) => {
    set({ selectedSerial: serial, packages: [] })
    if (!serial || !window.devInspector) return
    // A lista de pacotes é só sugestão no campo; falhar aqui (dispositivo
    // unauthorized, por exemplo) não impede digitar o pacote à mão.
    window.devInspector
      .logcatListPackages(serial)
      .then((packages) => {
        if (get().selectedSerial === serial) set({ packages })
      })
      .catch(() => {})
  },

  setPackageName: (packageName) => set({ packageName }),

  toggleLevel: (level) =>
    set((state) => {
      const levels = new Set(state.filter.levels)
      if (levels.has(level)) levels.delete(level)
      else levels.add(level)
      return { filter: { ...state.filter, levels } }
    }),

  setAllLevels: () => set((state) => ({ filter: { ...state.filter, levels: new Set(LOGCAT_LEVELS) } })),

  setSearch: (search) => set((state) => ({ filter: { ...state.filter, search } })),

  setSortOrder: (sortOrder) => set({ sortOrder }),

  start: async () => {
    const { selectedSerial, packageName } = get()
    if (!selectedSerial || !window.devInspector) return
    const status = await window.devInspector.logcatStart({ serial: selectedSerial, packageName: packageName || null })
    set({ status })
  },

  stop: async () => {
    if (!window.devInspector) return
    const status = await window.devInspector.logcatStop()
    set({ status })
  },

  getFilteredEntries: () => {
    const { entries, filter, sortOrder } = get()
    const filtered = filterLogcatEntries(entries, filter.levels, filter.search)
    // O store guarda sempre em ordem crescente; a decrescente é só uma visão.
    return sortOrder === 'desc' ? filtered.slice().reverse() : filtered
  },

  getLevelCounts: () => {
    const counts: Record<LogcatLevel, number> = { V: 0, D: 0, I: 0, W: 0, E: 0, F: 0 }
    for (const e of get().entries) counts[e.level]++
    return counts
  }
}))
