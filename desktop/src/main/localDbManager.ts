import { DatabaseSync } from 'node:sqlite'
import * as path from 'node:path'
import * as fs from 'node:fs'

export interface LocalDatabaseEntry {
  id: string
  name: string
  filePath: string
  sizeBytes: number
  isLocal: true
  db: DatabaseSync
}

export interface LocalDatabaseSummary {
  id: string
  name: string
  filePath: string
  sizeBytes: number
  isLocal: true
}

class LocalDbManager {
  private databases: Map<string, LocalDatabaseEntry> = new Map()

  importDatabase(filePath: string): LocalDatabaseSummary {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`)
    }

    // Check if already open by filePath
    for (const entry of this.databases.values()) {
      if (path.resolve(entry.filePath) === path.resolve(filePath)) {
        return {
          id: entry.id,
          name: entry.name,
          filePath: entry.filePath,
          sizeBytes: entry.sizeBytes,
          isLocal: true
        }
      }
    }

    const stat = fs.statSync(filePath)
    const name = path.basename(filePath)
    const id = `local:${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

    let db: DatabaseSync
    try {
      // Try read-write first
      db = new DatabaseSync(filePath, { readOnly: false })
    } catch (err: any) {
      // Fallback to readOnly if permission denied or file locked
      try {
        db = new DatabaseSync(filePath, { readOnly: true })
      } catch (innerErr: any) {
        throw new Error(`Falha ao abrir arquivo SQLite: ${innerErr.message || err.message}`)
      }
    }

    // Validate that it's indeed a valid SQLite database
    try {
      db.prepare('SELECT 1 FROM sqlite_master LIMIT 1').all()
    } catch (err: any) {
      try {
        db.close()
      } catch {}
      throw new Error(`O arquivo selecionado não parece ser um banco de dados SQLite válido: ${err.message}`)
    }

    const entry: LocalDatabaseEntry = {
      id,
      name,
      filePath,
      sizeBytes: stat.size,
      isLocal: true,
      db
    }

    this.databases.set(id, entry)

    return {
      id: entry.id,
      name: entry.name,
      filePath: entry.filePath,
      sizeBytes: entry.sizeBytes,
      isLocal: true
    }
  }

  closeDatabase(idOrName: string): boolean {
    const entry = this.getEntry(idOrName)
    if (!entry) return false

    try {
      entry.db.close()
    } catch (e) {
      console.error(`[LocalDbManager] Erro ao fechar banco ${entry.name}:`, e)
    }

    return this.databases.delete(entry.id)
  }

  listDatabases(): LocalDatabaseSummary[] {
    return Array.from(this.databases.values()).map(entry => ({
      id: entry.id,
      name: entry.name,
      filePath: entry.filePath,
      sizeBytes: entry.sizeBytes,
      isLocal: true
    }))
  }

  hasDatabase(idOrName: string): boolean {
    return this.getEntry(idOrName) !== undefined
  }

  getEntry(idOrName: string): LocalDatabaseEntry | undefined {
    if (this.databases.has(idOrName)) {
      return this.databases.get(idOrName)
    }
    // Search by name if needed
    for (const entry of this.databases.values()) {
      if (entry.name === idOrName || entry.id === idOrName) {
        return entry
      }
    }
    return undefined
  }

  executeCommand(payload: { action: string, dbName?: string, query?: string, args?: any[] }): any {
    const entry = this.getEntry(payload.dbName || '')
    if (!entry) {
      throw new Error(`Banco de dados local não encontrado: ${payload.dbName}`)
    }

    switch (payload.action) {
      case 'getTables': {
        const query = "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'android_%' ORDER BY name ASC"
        const rows = entry.db.prepare(query).all() as Array<{ name: string }>
        return rows.map(r => r.name)
      }

      case 'executeSql': {
        if (!payload.query) {
          throw new Error('Query SQL é obrigatória')
        }

        const trimmed = payload.query.trim()
        const upper = trimmed.toUpperCase()
        const isRead =
          upper.startsWith('SELECT') ||
          upper.startsWith('PRAGMA') ||
          upper.startsWith('EXPLAIN') ||
          upper.startsWith('WITH')

        const stmt = entry.db.prepare(trimmed)
        const args = payload.args || []

        if (isRead) {
          const rows = stmt.all(...args)
          // Clone null-prototype objects into standard plain objects
          return rows.map(row => ({ ...row }))
        } else {
          const result = stmt.run(...args)
          return {
            changes: result.changes,
            lastInsertRowid: result.lastInsertRowid !== undefined ? Number(result.lastInsertRowid) : undefined
          }
        }
      }

      default:
        throw new Error(`Ação não suportada para banco local: ${payload.action}`)
    }
  }

  closeAll(): void {
    for (const entry of this.databases.values()) {
      try {
        entry.db.close()
      } catch {}
    }
    this.databases.clear()
  }
}

export const localDbManager = new LocalDbManager()
