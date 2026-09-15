import type { DatabaseDriver } from '../../types'

export interface SqliteStorageAdapterOptions {
  /**
   * O pacote 'react-native-sqlite-storage'
   */
  sqliteLib: any
  
  /**
   * O pacote 'react-native-fs' ou similar que possui readDir
   */
  fsLib?: any

  /**
   * Pasta para procurar. Default: DocumentDirectoryPath
   */
  customDbPath?: string

  /**
   * Retorne os bancos de dados ativos no app manualmente. 
   */
  getDatabases?: () => Promise<string[]> | string[]
}

export class SqliteStorageAdapter implements DatabaseDriver {
  private options: SqliteStorageAdapterOptions
  private connectionCache: Record<string, any> = {}

  constructor(options: SqliteStorageAdapterOptions) {
    this.options = options
  }

  async getDatabases(): Promise<string[]> {
    if (this.options.getDatabases) {
      const dbs = await this.options.getDatabases()
      return Array.isArray(dbs) ? Array.from(new Set(dbs.filter(Boolean))) : []
    }

    if (this.options.fsLib) {
      try {
        const dir = this.options.customDbPath || this.options.fsLib.DocumentDirectoryPath
        const files = await this.options.fsLib.readDir(dir)
        return files
          .filter((f: any) => f.name.endsWith('.db') || f.name.endsWith('.sqlite'))
          .map((f: any) => f.name)
      } catch (e) {
        console.warn('[DevInspector] Erro ao ler pasta do File System:', e)
        return []
      }
    }

    console.warn('[DevInspector] Você precisa fornecer `getDatabases` ou `fsLib` no SqliteStorageAdapter para listar os bancos.')
    return []
  }

  private async getConnection(dbName: string) {
    if (this.connectionCache[dbName]) return this.connectionCache[dbName]
    
    // react-native-sqlite-storage API
    const db = await this.options.sqliteLib.openDatabase({ name: dbName, location: 'default' })
    this.connectionCache[dbName] = db
    return db
  }

  async getTables(dbName: string): Promise<string[]> {
    const db = await this.getConnection(dbName)
    const [results] = await db.executeSql("SELECT name FROM sqlite_master WHERE type='table'")
    const tables: string[] = []
    for (let i = 0; i < results.rows.length; i++) {
      const name = results.rows.item(i).name
      if (!name.startsWith('sqlite_') && !name.startsWith('android_')) {
        tables.push(name)
      }
    }
    return tables
  }

  async executeSql(dbName: string, query: string, args: any[] = []): Promise<any> {
    const db = await this.getConnection(dbName)
    const [results] = await db.executeSql(query, args)
    const rows: any[] = []
    for (let i = 0; i < results.rows.length; i++) {
      rows.push(results.rows.item(i))
    }
    return rows
  }
}

/**
 * Cria um adaptador Plug-and-Play para o react-native-sqlite-storage.
 */
export function createSqliteStorageAdapter(options: SqliteStorageAdapterOptions): DatabaseDriver {
  return new SqliteStorageAdapter(options)
}
