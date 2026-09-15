import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  NetworkRequest,
  NetworkRequestStartPayload,
  NetworkRequestEndPayload,
  NetworkRequestErrorPayload,
  MethodFilter,
  StatusFilter,
  NetworkStats
} from '../types/network'
import { MAX_NETWORK_LOGS } from '../utils/constants'
import { buildSearchMatcher, type SearchScope } from '../utils/searchMatcher'
import { hasGraphQLErrors } from '../utils/graphql'

interface NetworkState {
  requests: Map<string, NetworkRequest>
  filter: {
    method: MethodFilter
    status: StatusFilter
    search: string
    searchScope: SearchScope
    onlyErrors: boolean
  }
  selectedId: string | null
  pinnedIds: string[]
  panelWidth: number

  // Actions
  addRequestStart: (payload: NetworkRequestStartPayload) => void
  updateRequestEnd: (payload: NetworkRequestEndPayload) => void
  updateRequestError: (payload: NetworkRequestErrorPayload) => void
  clearRequests: () => void
  setMethodFilter: (method: MethodFilter) => void
  setStatusFilter: (status: StatusFilter) => void
  setSearch: (search: string) => void
  setSearchScope: (scope: SearchScope) => void
  setOnlyErrors: (onlyErrors: boolean) => void
  selectRequest: (id: string | null) => void
  togglePin: (id: string) => void
  selectNextRequest: (direction: 1 | -1) => void
  setPanelWidth: (width: number) => void

  // Derived
  getFilteredRequests: () => NetworkRequest[]
  getStats: () => NetworkStats
  getSelectedRequest: () => NetworkRequest | null
}

export const useNetworkStore = create<NetworkState>()(
  persist(
    (set, get) => ({
      requests: new Map(),
      filter: {
        method: 'ALL',
        status: 'ALL',
        search: '',
        searchScope: 'url',
        onlyErrors: false
      },
      selectedId: null,
      pinnedIds: [],
      panelWidth: 420,

      addRequestStart: (payload) => {
    set((state) => {
      const requests = new Map(state.requests)

      // FIFO cleanup if over limit
      if (requests.size >= MAX_NETWORK_LOGS) {
        const firstKey = requests.keys().next().value
        if (firstKey !== undefined) {
          requests.delete(firstKey)
        }
      }

      const req: NetworkRequest = {
        id: payload.id,
        method: payload.method,
        url: payload.url,
        requestHeaders: payload.requestHeaders,
        requestBody: payload.requestBody,
        responseHeaders: {},
        responseBody: null,
        statusCode: null,
        duration: null,
        responseSize: null,
        startTime: payload.startTime,
        endTime: null,
        status: 'pending',
        error: null,
        source: payload.source
      }

      requests.set(payload.id, req)
      return { requests }
    })
  },

  updateRequestEnd: (payload) => {
    set((state) => {
      const requests = new Map(state.requests)
      const existing = requests.get(payload.id)
      if (!existing) return state

      requests.set(payload.id, {
        ...existing,
        statusCode: payload.statusCode,
        responseHeaders: payload.responseHeaders,
        responseBody: payload.responseBody,
        responseSize: payload.responseSize,
        endTime: payload.endTime,
        duration: payload.duration,
        status: 'completed'
      })

      return { requests }
    })
  },

  updateRequestError: (payload) => {
    set((state) => {
      const requests = new Map(state.requests)
      const existing = requests.get(payload.id)
      if (!existing) return state

      requests.set(payload.id, {
        ...existing,
        error: payload.error,
        endTime: payload.endTime,
        duration: payload.duration,
        status: 'error'
      })

      return { requests }
    })
  },

  clearRequests: () => set({ requests: new Map(), selectedId: null }),

  setMethodFilter: (method) =>
    set((state) => ({ filter: { ...state.filter, method } })),

  setStatusFilter: (status) =>
    set((state) => ({ filter: { ...state.filter, status } })),

  setSearch: (search) =>
    set((state) => ({ filter: { ...state.filter, search } })),

  setSearchScope: (searchScope) =>
    set((state) => ({ filter: { ...state.filter, searchScope } })),

  setOnlyErrors: (onlyErrors) =>
    set((state) => ({ filter: { ...state.filter, onlyErrors } })),

  selectRequest: (id) => set({ selectedId: id }),

  togglePin: (id) => set((state) => {
    if (state.pinnedIds.includes(id)) {
      return { pinnedIds: state.pinnedIds.filter(pid => pid !== id) }
    }
    return { pinnedIds: [...state.pinnedIds, id] }
  }),

  selectNextRequest: (direction) => {
    const { getFilteredRequests, selectedId, selectRequest } = get()
    const filtered = getFilteredRequests()
    if (filtered.length === 0) return

    if (!selectedId) {
      selectRequest(filtered[0].id)
      return
    }

    const currentIndex = filtered.findIndex(r => r.id === selectedId)
    if (currentIndex === -1) {
      selectRequest(filtered[0].id)
      return
    }

    let nextIndex = currentIndex + direction
    if (nextIndex < 0) nextIndex = 0
    if (nextIndex >= filtered.length) nextIndex = filtered.length - 1

    selectRequest(filtered[nextIndex].id)
  },

  getFilteredRequests: () => {
    const { requests, filter, pinnedIds } = get()
    let result = Array.from(requests.values())

    if (filter.method !== 'ALL') {
      result = result.filter((r) => r.method === filter.method)
    }

    if (filter.status !== 'ALL') {
      result = result.filter((r) => {
        if (r.statusCode === null) return false
        const prefix = filter.status.replace('xx', '')
        return String(r.statusCode).startsWith(prefix)
      })
    }

    if (filter.onlyErrors) {
      result = result.filter(
        (r) =>
          r.status === 'error' ||
          (r.statusCode !== null && r.statusCode >= 400) ||
          // GraphQL sinaliza falha no corpo, com status 200
          hasGraphQLErrors(r)
      )
    }

    if (filter.search) {
      const matches = buildSearchMatcher(filter.search, filter.searchScope)
      result = result.filter(matches)
    }

    const pinned: NetworkRequest[] = []
    const unpinned: NetworkRequest[] = []
    
    for (const r of result) {
      if (pinnedIds.includes(r.id)) {
        pinned.push(r)
      } else {
        unpinned.push(r)
      }
    }

    return [...pinned, ...unpinned]
  },

  getStats: () => {
    const requests = Array.from(get().requests.values())
    const completed = requests.filter((r) => r.status === 'completed')
    const failed = requests.filter(
      (r) =>
        r.status === 'error' ||
        (r.statusCode !== null && r.statusCode >= 400) ||
        hasGraphQLErrors(r)
    )
    const pending = requests.filter((r) => r.status === 'pending')
    const durations = completed
      .map((r) => r.duration)
      .filter((d): d is number => d !== null)
    const avgDuration = durations.length
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0
    const totalSize = requests
      .map((r) => r.responseSize ?? 0)
      .reduce((a, b) => a + b, 0)

    return {
      total: requests.length,
      completed: completed.length,
      failed: failed.length,
      pending: pending.length,
      avgDuration,
      totalSize
    }
  },

  getSelectedRequest: () => {
    const { requests, selectedId } = get()
    if (!selectedId) return null
    return requests.get(selectedId) ?? null
  },
  
  setPanelWidth: (width) => set({ panelWidth: width })
    }),
    {
      name: 'devinspector-network-store',
      partialize: (state) => ({ filter: state.filter, pinnedIds: state.pinnedIds, panelWidth: state.panelWidth })
    }
  )
)
