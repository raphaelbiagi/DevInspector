import { create } from 'zustand'
import type { ClientInfo } from '../types/protocol'

interface ConnectionState {
  connected: boolean
  clientInfo: ClientInfo | null

  setConnected: (info: ClientInfo) => void
  setDisconnected: () => void
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  connected: false,
  clientInfo: null,

  setConnected: (info) => set({ connected: true, clientInfo: info }),
  setDisconnected: () => set({ connected: false, clientInfo: null })
}))
