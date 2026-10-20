import type { DatabaseDriver } from '../../types'

export interface ExpoSqliteAdapterOptions {
  /**
   * O pacote 'expo-sqlite'
   */
  sqliteLib: any
  
  /**
   * Retorne os bancos de dados ativos no app. 
   * Ex: () => [BANCO_PADRAO, getNomeBancoAtual()]
   */
  getDatabases?: () => Promise<string[]> | string[]
  
  /**
   * O pacote 'expo-file-system' (opcional, usado para escanear a pasta caso getDatabases não seja fornecido)
   */
  fsLib?: any
}

export class ExpoSqliteAdapter implements DatabaseDriver {
  private options: ExpoSqliteAdapterOptions
  private connectionCache: Record<string, any> = {}

  constructor(options: ExpoSqliteAdapterOptions) {
    this.options = options
  }

  async getDatabases(): Promise<string[]> {
    if (this.options.getDatabases) {
      const dbs = await this.options.getDatabases()
      return Array.isArray(dbs) ? Array.from(new Set(dbs.filter(Boolean))) : []
    }

    if (this.options.fsLib) {
      try {
        const dir = this.options.fsLib.documentDirectory + 'SQLite/'
        const files = await this.options.fsLib.readDirectoryAsync(dir)
        return files.filter((f: string) => f.endsWith('.db') || f.endsWith('.sqlite'))
      } catch (e) {
        console.warn('[DevInspector] Erro ao ler pasta do Expo File System:', e)
        return []
      }
    }

    console.warn('[DevInspector] Você precisa fornecer `getDatabases` ou `fsLib` no ExpoSqliteAdapter para listar os bancos.')
    return []
  }

  private async getConnection(dbName: string) {
    if (this.connectionCache[dbName]) return this.connectionCache[dbName]
    
    // expo-sqlite API
    const db = await this.options.sqliteLib.openDatabaseAsync(dbName)
    this.connectionCache[dbName] = db
    return db
  }

  async getTables(dbName: string): Promise<string[]> {
    const db = await this.getConnection(dbName)
    // expo-sqlite usa getAllAsync
    const results = await db.getAllAsync("SELECT name FROM sqlite_master WHERE type='table'")
    return results
      .map((r: any) => r.name)
      .filter((name: string) => !name.startsWith('sqlite_') && !name.startsWith('android_'))
  }

  async executeSql(dbName: string, query: string, args: any[] = [], onChunk?: (chunk: any[]) => void): Promise<any> {
    const db = await this.getConnection(dbName)
    const upperQuery = query.trim().toUpperCase()
    
    // Detecta operações de leitura para usar getAllAsync
    const isRead = upperQuery.startsWith('SELECT') || upperQuery.startsWith('PRAGMA') || upperQuery.startsWith('EXPLAIN')

    if (isRead) {
      if (onChunk) {
        let chunk: any[] = []
        try {
          for await (const row of db.getEachAsync(query, args)) {
            chunk.push(row)
            if (chunk.length >= 500) {
              onChunk(chunk)
              chunk = []
              // Dá um respiro para o event loop e para o WebSocket conseguir enviar
              await new Promise(resolve => setTimeout(resolve, 0))
            }
          }
          if (chunk.length > 0) {
            onChunk(chunk)
          }
          return { streamed: true }
        } catch (error) {
          throw error
        }
      } else {
        return await db.getAllAsync(query, args)
      }
    } else {
      // expo-sqlite runAsync retorna objeto com meta dados de inserção
      const result = await db.runAsync(query, args)
      return [{
        Mudanças: result.changes,
        UltimoIdInserido: result.lastInsertRowId
      }]
    }
  }
}

/**
 * Cria um adaptador Plug-and-Play para o expo-sqlite.
 */
export function createExpoSqliteAdapter(options: ExpoSqliteAdapterOptions): DatabaseDriver {
  return new ExpoSqliteAdapter(options)
}
