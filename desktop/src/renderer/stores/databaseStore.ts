import { create } from 'zustand'

interface SavedQuery {
  name: string
  query: string
}

interface DatabaseState {
  databases: string[]
  selectedDb: string | null
  tables: string[]
  selectedTable: string | null
  tableData: { columns: string[], rows: any[] } | null
  
  tableTotalRows: number
  tablePageSize: number
  tableCurrentPage: number

  queryResult: { columns: string[], rows: any[] } | null
  queryError: string | null
  isLoading: boolean
  
  savedQueries: SavedQuery[]

  fetchDatabases: () => Promise<void>
  selectDb: (db: string | null) => Promise<void>
  selectTable: (table: string) => Promise<void>
  fetchTableData: (page: number) => Promise<void>
  executeQuery: (query: string) => Promise<void>
  clearError: () => void
  
  loadSavedQueries: () => void
  saveQuery: (name: string, query: string) => void
  deleteQuery: (name: string) => void
}

export const useDatabaseStore = create<DatabaseState>((set, get) => ({
  databases: [],
  selectedDb: null,
  tables: [],
  selectedTable: null,
  tableData: null,
  
  tableTotalRows: 0,
  tablePageSize: 50,
  tableCurrentPage: 1,

  queryResult: null,
  queryError: null,
  isLoading: false,
  
  savedQueries: [],

  clearError: () => set({ queryError: null }),

  loadSavedQueries: () => {
    try {
      const stored = localStorage.getItem('devinspector_saved_queries')
      if (stored) {
        set({ savedQueries: JSON.parse(stored) })
      }
    } catch (e) {
      console.error('Error loading saved queries', e)
    }
  },

  saveQuery: (name: string, query: string) => {
    const { savedQueries } = get()
    const newQueries = [...savedQueries.filter(q => q.name !== name), { name, query }]
    localStorage.setItem('devinspector_saved_queries', JSON.stringify(newQueries))
    set({ savedQueries: newQueries })
  },
  
  deleteQuery: (name: string) => {
    const { savedQueries } = get()
    const newQueries = savedQueries.filter(q => q.name !== name)
    localStorage.setItem('devinspector_saved_queries', JSON.stringify(newQueries))
    set({ savedQueries: newQueries })
  },

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
    set({ 
      selectedDb: dbName, tables: [], selectedTable: null, tableData: null, 
      queryResult: null, isLoading: !!dbName, queryError: null,
      tableTotalRows: 0, tableCurrentPage: 1
    })
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

    set({ selectedTable: tableName, tableData: null, queryResult: null, isLoading: true, queryError: null, tableCurrentPage: 1 })
    
    try {
      let countData: any[] = []
      const unsubCount = window.devInspector.onDbChunk((payload) => {
        if (payload.chunk) countData.push(...payload.chunk)
      })
      const cRes = await window.devInspector.executeDbCommand({
        action: 'executeSql',
        dbName: selectedDb,
        query: `SELECT COUNT(*) as total FROM ${tableName}`
      })
      unsubCount()
      const countResult = (cRes && cRes.streamed) ? countData : cRes
      
      let total = 0
      if (Array.isArray(countResult) && countResult.length > 0) {
        total = countResult[0].total || countResult[0]['COUNT(*)'] || 0
      }
      
      set({ tableTotalRows: total })
      await get().fetchTableData(1)
    } catch (err: any) {
      set({ queryError: err.message, isLoading: false })
    }
  },

  fetchTableData: async (page: number) => {
    const { selectedDb, selectedTable, tablePageSize } = get()
    if (!selectedDb || !selectedTable) return

    set({ isLoading: true, queryError: null, tableCurrentPage: page })
    
    try {
      const offset = (page - 1) * tablePageSize
      let pageData: any[] = []
      const unsub = window.devInspector.onDbChunk((payload) => {
        if (payload.chunk) pageData.push(...payload.chunk)
      })
      const res = await window.devInspector.executeDbCommand({
        action: 'executeSql',
        dbName: selectedDb,
        query: `SELECT * FROM ${selectedTable} LIMIT ${tablePageSize} OFFSET ${offset}`
      })
      unsub()
      const result = (res && res.streamed) ? pageData : res
      
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
    
    let unsubChunk = () => {}
    try {
      unsubChunk = window.devInspector.onDbChunk((payload: any) => {
        const chunk = payload.chunk || []
        if (chunk.length > 0) {
          set(state => {
            const currentResult = state.queryResult
            if (currentResult) {
              return { queryResult: { ...currentResult, rows: [...currentResult.rows, ...chunk] } }
            } else {
              // Initialize on first chunk
              return { queryResult: { columns: Object.keys(chunk[0]), rows: chunk } }
            }
          })
        }
      })

      // Evitar congelamento de UI em queries SELECT sem limite
      let finalQuery = query.trim()
      if (finalQuery.toUpperCase().startsWith('SELECT') && !/LIMIT\s+\d+/i.test(finalQuery)) {
        finalQuery = `${finalQuery} LIMIT 500`
      }

      const result = await window.devInspector.executeDbCommand({
        action: 'executeSql',
        dbName: selectedDb,
        query: finalQuery
      })
      unsubChunk()

      if (result && result.streamed) {
        // Chunks were already handled progressively
        set(state => {
          if (!state.queryResult) return { queryResult: { columns: [], rows: [] }, isLoading: false }
          return { isLoading: false }
        })
      } else {
        // Fallback for non-streamed results (or mutations)
        if (Array.isArray(result) && result.length > 0) {
          set({ queryResult: { columns: Object.keys(result[0]), rows: result }, isLoading: false })
        } else if (Array.isArray(result)) {
          set({ queryResult: { columns: [], rows: [] }, isLoading: false })
        } else {
          set({ queryResult: { columns: ['Resultado'], rows: [{ Resultado: JSON.stringify(result) }] }, isLoading: false })
        }
      }
    } catch (err: any) {
      unsubChunk()
      set({ queryError: err.message, isLoading: false })
    }
  }
}))
