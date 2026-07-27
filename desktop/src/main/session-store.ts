import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as readline from 'readline'
import type { DevInspectorEvent } from './protocol'

interface Session {
  id: string
  startedAt: number
  endedAt?: number
  deviceInfo?: Record<string, unknown>
  events: DevInspectorEvent[]
}

interface SessionMeta {
  id: string
  startedAt: number
  endedAt?: number
  deviceInfo?: Record<string, unknown>
  eventCount: number
}

interface SessionIndex {
  sessions: Array<{
    id: string
    startedAt: number
    endedAt?: number
    deviceName?: string
    eventCount: number
  }>
}

const MAX_SESSIONS = 20           // Mantém últimas 20 sessões
const MAX_EVENTS_PER_SESSION = 5000

export class SessionStore {
  private dir: string
  private currentSessionMeta: SessionMeta | null = null
  private pendingLines: string[] = []
  private flushTimeout: NodeJS.Immediate | null = null
  private flushPromise: Promise<void> | null = null

  constructor() {
    this.dir = path.join(app.getPath('userData'), 'sessions')
    fs.mkdirSync(this.dir, { recursive: true })
  }

  startSession(id: string): void {
    this.currentSessionMeta = {
      id,
      startedAt: Date.now(),
      eventCount: 0,
    }
    this.pendingLines = []
  }

  appendEvent(event: DevInspectorEvent): void {
    if (!this.currentSessionMeta) return
    if (this.currentSessionMeta.eventCount >= MAX_EVENTS_PER_SESSION) return
    
    this.currentSessionMeta.eventCount++
    this.pendingLines.push(JSON.stringify(event))
    
    if (!this.flushTimeout) {
      this.flushTimeout = setImmediate(() => {
        this.flushTimeout = null
        this.flushPromise = this.flush().finally(() => {
          this.flushPromise = null
        })
      })
    }
  }

  setDeviceInfo(info: Record<string, unknown>): void {
    if (!this.currentSessionMeta) return
    this.currentSessionMeta.deviceInfo = info
  }

  async endSession(): Promise<void> {
    if (!this.currentSessionMeta) return
    this.currentSessionMeta.endedAt = Date.now()
    
    // Aguarda o último flush pendente
    if (this.flushTimeout) {
      clearImmediate(this.flushTimeout)
      this.flushTimeout = null
      await this.flush()
    } else if (this.flushPromise) {
      await this.flushPromise
    }

    const metaPath = path.join(this.dir, `${this.currentSessionMeta.id}.meta.json`)
    try {
      await fs.promises.writeFile(metaPath, JSON.stringify(this.currentSessionMeta), 'utf-8')
    } catch { /* ignora */ }

    this.updateIndex()
    this.pruneOldSessions()
    this.currentSessionMeta = null
  }

  private async flush(): Promise<void> {
    if (!this.currentSessionMeta || this.pendingLines.length === 0) return
    
    const linesToProcess = this.pendingLines
    this.pendingLines = []
    
    const ndjsonPath = path.join(this.dir, `${this.currentSessionMeta.id}.ndjson`)
    const data = linesToProcess.join('\n') + '\n'
    
    try {
      await fs.promises.appendFile(ndjsonPath, data, 'utf-8')
    } catch {
      // Ignora erros de I/O
    }
  }

  listSessions(): SessionIndex['sessions'] {
    const indexPath = path.join(this.dir, 'index.json')
    if (!fs.existsSync(indexPath)) return []
    try {
      const raw = fs.readFileSync(indexPath, 'utf-8')
      const index: SessionIndex = JSON.parse(raw)
      return index.sessions.sort((a, b) => b.startedAt - a.startedAt)
    } catch {
      return []
    }
  }

  async loadSession(id: string): Promise<Session | null> {
    const metaPath = path.join(this.dir, `${id}.meta.json`)
    const ndjsonPath = path.join(this.dir, `${id}.ndjson`)
    const legacyPath = path.join(this.dir, `${id}.json`)

    if (fs.existsSync(metaPath) && fs.existsSync(ndjsonPath)) {
      try {
        const meta: SessionMeta = JSON.parse(await fs.promises.readFile(metaPath, 'utf-8'))
        const session: Session = {
          id: meta.id,
          startedAt: meta.startedAt,
          endedAt: meta.endedAt,
          deviceInfo: meta.deviceInfo,
          events: []
        }

        const fileStream = fs.createReadStream(ndjsonPath)
        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity
        })

        for await (const line of rl) {
          if (line.trim()) {
            session.events.push(JSON.parse(line))
          }
        }
        return session
      } catch {
        return null
      }
    } else if (fs.existsSync(legacyPath)) {
      try {
        return JSON.parse(await fs.promises.readFile(legacyPath, 'utf-8')) as Session
      } catch {
        return null
      }
    }

    return null
  }

  private updateIndex(): void {
    if (!this.currentSessionMeta) return
    const indexPath = path.join(this.dir, 'index.json')
    let index: SessionIndex = { sessions: [] }
    try {
      if (fs.existsSync(indexPath)) {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
      }
    } catch { /* ignora */ }

    // Remove entrada antiga com mesmo ID se existir
    index.sessions = index.sessions.filter(s => s.id !== this.currentSessionMeta!.id)
    index.sessions.push({
      id: this.currentSessionMeta.id,
      startedAt: this.currentSessionMeta.startedAt,
      endedAt: this.currentSessionMeta.endedAt,
      deviceName: this.currentSessionMeta.deviceInfo?.deviceName as string | undefined,
      eventCount: this.currentSessionMeta.eventCount,
    })
    fs.writeFileSync(indexPath, JSON.stringify(index), 'utf-8')
  }

  private pruneOldSessions(): void {
    const sessions = this.listSessions()
    if (sessions.length <= MAX_SESSIONS) return

    const toDelete = sessions.slice(MAX_SESSIONS)
    for (const s of toDelete) {
      const ndjsonPath = path.join(this.dir, `${s.id}.ndjson`)
      const metaPath = path.join(this.dir, `${s.id}.meta.json`)
      const legacyPath = path.join(this.dir, `${s.id}.json`)
      
      try { if (fs.existsSync(ndjsonPath)) fs.unlinkSync(ndjsonPath) } catch { /* ignora */ }
      try { if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath) } catch { /* ignora */ }
      try { if (fs.existsSync(legacyPath)) fs.unlinkSync(legacyPath) } catch { /* ignora */ }
    }

    // Atualiza index
    const indexPath = path.join(this.dir, 'index.json')
    const toDeleteIds = new Set(toDelete.map(s => s.id))
    const remaining = sessions.filter(s => !toDeleteIds.has(s.id))
    fs.writeFileSync(indexPath, JSON.stringify({ sessions: remaining }), 'utf-8')
  }
}
