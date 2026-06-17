import { create } from 'zustand'

interface DatabaseState {
  databases: string[]
  selectedDb: string | null
  tables: string[]
  selectedTable: string | null
  tableData: { columns: string[], rows: any[] } | null
  queryResult: { columns: string[], rows: any[] } | null
  queryError: string | null
  isLoading: boolean

  fetchDatabases: () => Promise<void>
  selectDb: (db: string | null) => Promise<void>
  selectTable: (table: string) => Promise<void>
  executeQuery: (query: string) => Promise<void>
  clearError: () => void
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  databases: [],
  selectedDb: null,
  tables: [],
  selectedTable: null,
  tableData: null,
  queryResult: null,
  queryError: null,
  isLoading: false,

  clearError: () => set({ queryError: null }),

  fetchDatabases: async () => {
    set({ isLoading: true, queryError: null })
    try {
      const dbs = await window.devInspector.executeDbCommand({ action: 'getDatabases' })
      set({ databases: dbs || [], isLoading: false })
    } catch (err: any) {
      set({ queryError: err.message, isLoading: false })
    }
  },

  selectDb: async (dbName: string | null) => {
    set({ selectedDb: dbName, tables: [], selectedTable: null, tableData: null, queryResult: null, isLoading: !!dbName, queryError: null })
    if (!dbName) return
    
    try {
      const tables = await window.devInspector.executeDbCommand({ action: 'getTables', dbName })
      set({ tables: tables || [], isLoading: false })
    } catch (err: any) {
      set({ queryError: err.message, isLoading: false })
    }
  },

  selectTable: async (tableName: string) => {
    const { selectedDb } = get()
    if (!selectedDb) return

    set({ selectedTable: tableName, tableData: null, queryResult: null, isLoading: true, queryError: null })
    try {
      // Basic SELECT query
      const result = await window.devInspector.executeDbCommand({
        action: 'executeSql',
        dbName: selectedDb,
        query: `SELECT * FROM ${tableName} LIMIT 100`
      })
      if (Array.isArray(result) && result.length > 0) {
        set({ tableData: { columns: Object.keys(result[0]), rows: result }, isLoading: false })
      } else {
        set({ tableData: { columns: [], rows: [] }, isLoading: false })
      }
    } catch (err: any) {
      set({ queryError: err.message, isLoading: false })
    }
  },

  executeQuery: async (query: string) => {
    const { selectedDb } = get()
    if (!selectedDb) {
      set({ queryError: 'Selecione um banco de dados primeiro' })
      return
    }

    set({ isLoading: true, queryError: null, queryResult: null })
    try {
      const result = await window.devInspector.executeDbCommand({
        action: 'executeSql',
        dbName: selectedDb,
        query
      })
      if (Array.isArray(result) && result.length > 0) {
        set({ queryResult: { columns: Object.keys(result[0]), rows: result }, isLoading: false })
      } else if (Array.isArray(result)) {
        set({ queryResult: { columns: [], rows: [] }, isLoading: false })
      } else {
        // Para comandos como UPDATE/INSERT que talvez não retornem linhas
        set({ queryResult: { columns: ['Resultado'], rows: [{ Resultado: JSON.stringify(result) }] }, isLoading: false })
      }
    } catch (err: any) {
      set({ queryError: err.message, isLoading: false })
    }
  }
}))
