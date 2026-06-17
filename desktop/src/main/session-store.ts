import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import type { DevInspectorEvent } from './protocol'

interface Session {
  id: string
  startedAt: number
  endedAt?: number
  deviceInfo?: Record<string, unknown>
  events: DevInspectorEvent[]
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
  private currentSession: Session | null = null

  constructor() {
    this.dir = path.join(app.getPath('userData'), 'sessions')
    fs.mkdirSync(this.dir, { recursive: true })
  }

  startSession(id: string): void {
    this.currentSession = {
      id,
      startedAt: Date.now(),
      events: [],
    }
  }

  appendEvent(event: DevInspectorEvent): void {
    if (!this.currentSession) return
    if (this.currentSession.events.length >= MAX_EVENTS_PER_SESSION) return
    this.currentSession.events.push(event)
    // Flush assíncrono para não bloquear a thread principal
    setImmediate(() => this.persist())
  }

  setDeviceInfo(info: Record<string, unknown>): void {
    if (!this.currentSession) return
    this.currentSession.deviceInfo = info
  }

  endSession(): void {
    if (!this.currentSession) return
    this.currentSession.endedAt = Date.now()
    this.persist()
    this.updateIndex()
    this.pruneOldSessions()
    this.currentSession = null
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

  loadSession(id: string): Session | null {
    const filePath = path.join(this.dir, `${id}.json`)
    if (!fs.existsSync(filePath)) return null
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Session
    } catch {
      return null
    }
  }

  private persist(): void {
    if (!this.currentSession) return
    const filePath = path.join(this.dir, `${this.currentSession.id}.json`)
    try {
      fs.writeFileSync(filePath, JSON.stringify(this.currentSession), 'utf-8')
    } catch {
      // Ignora erros de I/O — nunca deve travar o app
    }
  }

  private updateIndex(): void {
    if (!this.currentSession) return
    const indexPath = path.join(this.dir, 'index.json')
    let index: SessionIndex = { sessions: [] }
    try {
      if (fs.existsSync(indexPath)) {
        index = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
      }
    } catch { /* ignora */ }

    // Remove entrada antiga com mesmo ID se existir
    index.sessions = index.sessions.filter(s => s.id !== this.currentSession!.id)
    index.sessions.push({
      id: this.currentSession.id,
      startedAt: this.currentSession.startedAt,
      endedAt: this.currentSession.endedAt,
      deviceName: this.currentSession.deviceInfo?.deviceName as string | undefined,
      eventCount: this.currentSession.events.length,
    })
    fs.writeFileSync(indexPath, JSON.stringify(index), 'utf-8')
  }

  private pruneOldSessions(): void {
    const sessions = this.listSessions()
    if (sessions.length <= MAX_SESSIONS) return

    const toDelete = sessions.slice(MAX_SESSIONS)
    for (const s of toDelete) {
      const filePath = path.join(this.dir, `${s.id}.json`)
      try { fs.unlinkSync(filePath) } catch { /* ignora */ }
    }

    // Atualiza index
    const indexPath = path.join(this.dir, 'index.json')
    const toDeleteIds = new Set(toDelete.map(s => s.id))
    const remaining = sessions.filter(s => !toDeleteIds.has(s.id))
    fs.writeFileSync(indexPath, JSON.stringify({ sessions: remaining }), 'utf-8')
  }
}
