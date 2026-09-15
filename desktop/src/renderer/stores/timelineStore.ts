import { create } from 'zustand'
import type { AnomalyPayload, RequestDiffPayload } from '../types/protocol'

// --- Tipos da Timeline ---

export type TimelineItemType = 'request' | 'response' | 'console' | 'anomaly'

export interface TimelineItem {
  id: string
  timestamp: number
  type: TimelineItemType
  data: Record<string, unknown>
  correlationId?: string  // Liga request ao response
}

interface TimelineState {
  items: TimelineItem[]
  anomalies: AnomalyPayload[]
  diffs: Map<string, RequestDiffPayload>
  selectedId: string | null

  // Actions
  addItem: (item: TimelineItem) => void
  addAnomaly: (anomaly: AnomalyPayload) => void
  addDiff: (diff: RequestDiffPayload) => void
  selectItem: (id: string | null) => void
  clearAll: () => void

  // Derived
  getSortedItems: () => TimelineItem[]
  getSelectedItem: () => TimelineItem | null
  getDiffForRequest: (requestId: string) => RequestDiffPayload | null
  getAnomaliesForItem: (relatedId: string) => AnomalyPayload[]
}

const MAX_TIMELINE_ITEMS = 5000
const MAX_ANOMALIES = 1000
const MAX_DIFFS = 1000

export const useTimelineStore = create<TimelineState>((set, get) => ({
  items: [],
  anomalies: [],
  diffs: new Map(),
  selectedId: null,

  addItem: (item) => {
    set((state) => {
      let items = [...state.items, item]
      if (items.length > MAX_TIMELINE_ITEMS) {
        items = items.slice(items.length - MAX_TIMELINE_ITEMS)
      }
      return { items }
    })
  },

  addAnomaly: (anomaly) => {
    set((state) => {
      let anomalies = [...state.anomalies, anomaly]
      if (anomalies.length > MAX_ANOMALIES) {
        anomalies = anomalies.slice(anomalies.length - MAX_ANOMALIES)
      }
      // Também adiciona como item na timeline
      const item: TimelineItem = {
        id: anomaly.id,
        timestamp: anomaly.timestamp,
        type: 'anomaly',
        data: anomaly as unknown as Record<string, unknown>,
        correlationId: anomaly.relatedId,
      }
      let items = [...state.items, item]
      if (items.length > MAX_TIMELINE_ITEMS) {
        items = items.slice(items.length - MAX_TIMELINE_ITEMS)
      }
      return { anomalies, items }
    })
  },

  addDiff: (diff) => {
    set((state) => {
      const diffs = new Map(state.diffs)
      // FIFO: descarta o diff mais antigo (Map preserva ordem de inserção)
      if (!diffs.has(diff.requestId) && diffs.size >= MAX_DIFFS) {
        const oldestKey = diffs.keys().next().value
        if (oldestKey !== undefined) diffs.delete(oldestKey)
      }
      diffs.set(diff.requestId, diff)
      return { diffs }
    })
  },

  selectItem: (id) => set({ selectedId: id }),

  clearAll: () => set({
    items: [],
    anomalies: [],
    diffs: new Map(),
    selectedId: null,
  }),

  getSortedItems: () => {
    return [...get().items].sort((a, b) => a.timestamp - b.timestamp)
  },

  getSelectedItem: () => {
    const { items, selectedId } = get()
    if (!selectedId) return null
    return items.find(i => i.id === selectedId) ?? null
  },

  getDiffForRequest: (requestId) => {
    return get().diffs.get(requestId) ?? null
  },

  getAnomaliesForItem: (relatedId) => {
    return get().anomalies.filter(a => a.relatedId === relatedId)
  },
}))
