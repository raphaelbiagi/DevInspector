import { EventEmitter } from 'events'
import { spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { resolveAdbPath, runAdb, AdbNotFoundError } from './adb'
import {
  LogcatEntry,
  LogcatDevice,
  parseLogcatLine,
  isContinuation,
  parseAdbDevices,
  parsePackageList,
  parsePidList
} from './logcat-parser'

export interface LogcatStatus {
  running: boolean
  serial: string | null
  packageName: string | null
  pids: number[]
  error: string | null
}

export interface LogcatStartOptions {
  serial: string
  packageName?: string | null
}

// Linhas do buffer anteriores ao start: dá contexto do que aconteceu logo
// antes de abrir a aba (ex.: o crash que motivou abrir a aba).
const BACKLOG_LINES = 1000
// Um logcat sem filtro passa fácil de mil linhas por segundo; mandar uma IPC
// por linha trava o renderer.
const FLUSH_INTERVAL_MS = 100
const MAX_BATCH = 2000
const PID_POLL_MS = 2000

// O nome do pacote vai parar num comando de shell remoto (`adb shell pidof`) e
// pode vir do handshake do SDK — só aceita o formato de applicationId.
const PACKAGE_RE = /^[A-Za-z0-9_]+(\.[A-Za-z0-9_]+)*$/

/**
 * Lê o logcat do dispositivo pelo adb do desktop. Independe da conexão
 * WebSocket com o SDK: crashes nativos derrubam o JS antes de qualquer
 * console.error chegar, e é justamente aí que o logcat importa.
 */
export class LogcatManager extends EventEmitter {
  private child: ChildProcess | null = null
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private pidTimer: ReturnType<typeof setInterval> | null = null
  private batch: LogcatEntry[] = []
  private nextId = 1
  // Todos os PIDs que o app já teve nesta captura: se o app reinicia, as
  // últimas linhas do processo antigo (o crash) ainda chegam depois do pidof novo.
  private pids = new Set<number>()
  // Invalida um start() que ainda aguarda o pidof quando outro start/stop chega.
  private generation = 0
  private status: LogcatStatus = { running: false, serial: null, packageName: null, pids: [], error: null }

  getStatus(): LogcatStatus {
    return this.status
  }

  async listDevices(): Promise<{ devices: LogcatDevice[]; error: string | null }> {
    try {
      const output = await runAdb(['devices', '-l'])
      return { devices: parseAdbDevices(output), error: null }
    } catch (err: any) {
      return { devices: [], error: err?.message || String(err) }
    }
  }

  async listPackages(serial: string): Promise<string[]> {
    // -3: só apps instalados pelo usuário; os do sistema são centenas e nunca são o alvo.
    const output = await runAdb(['-s', serial, 'shell', 'pm', 'list', 'packages', '-3'])
    return parsePackageList(output)
  }

  async start(options: LogcatStartOptions): Promise<LogcatStatus> {
    this.stop()
    const generation = ++this.generation
    const packageName = options.packageName?.trim() || null

    if (packageName && !PACKAGE_RE.test(packageName)) {
      this.setStatus({ running: false, serial: options.serial, packageName, pids: [], error: `Nome de pacote inválido: ${packageName}` })
      return this.status
    }

    const adbPath = await resolveAdbPath()
    if (generation !== this.generation) return this.status
    if (!adbPath) {
      this.setStatus({ running: false, serial: options.serial, packageName, pids: [], error: new AdbNotFoundError().message })
      return this.status
    }

    this.pids.clear()
    if (packageName) {
      // Antes do spawn: sem os PIDs, o backlog inteiro seria descartado pelo filtro.
      await this.refreshPids(options.serial, packageName)
      if (generation !== this.generation) return this.status
    }

    const child = spawn(
      adbPath,
      ['-s', options.serial, 'logcat', '-v', 'threadtime', '-T', String(BACKLOG_LINES)],
      { windowsHide: true }
    )
    this.child = child

    let stderrTail = ''

    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-500)
    })

    const lines = createInterface({ input: child.stdout!, crlfDelay: Infinity })
    lines.on('line', (line) => this.handleLine(line.replace(/\r$/, ''), packageName))

    // stop() zera this.child antes do kill, então um encerramento pedido pelo
    // usuário cai no return e não vira mensagem de erro.
    const onEnd = (error: string | null) => {
      if (this.child !== child) return
      this.child = null
      this.clearTimers()
      this.flush()
      this.setStatus({ ...this.status, running: false, error })
    }
    child.on('error', (err) => onEnd(err.message))
    child.on('exit', (code) => {
      onEnd(code === 0 ? null : stderrTail.trim() || 'O logcat foi encerrado. O dispositivo foi desconectado?')
    })

    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS)
    if (packageName) {
      this.pidTimer = setInterval(() => {
        this.refreshPids(options.serial, packageName).catch(() => {})
      }, PID_POLL_MS)
    }

    this.setStatus({ running: true, serial: options.serial, packageName, pids: [...this.pids], error: null })
    return this.status
  }

  stop(): void {
    this.generation++
    this.clearTimers()
    const child = this.child
    this.child = null
    child?.kill()
    this.flush()
    if (this.status.running) {
      this.setStatus({ ...this.status, running: false, error: null })
    }
  }

  private handleLine(line: string, packageName: string | null): void {
    const entry = parseLogcatLine(line, this.nextId)
    if (!entry) return
    if (packageName && !this.pids.has(entry.pid)) return

    const last = this.batch[this.batch.length - 1]
    if (last && isContinuation(last, entry)) {
      last.message += '\n' + entry.message
      return
    }

    this.nextId++
    this.batch.push(entry)
    if (this.batch.length >= MAX_BATCH) this.flush()
  }

  private async refreshPids(serial: string, packageName: string): Promise<void> {
    let current: number[] = []
    try {
      current = parsePidList(await runAdb(['-s', serial, 'shell', 'pidof', packageName], 5000))
    } catch {
      // pidof sai com código 1 quando o processo não está rodando.
    }
    const before = this.pids.size
    current.forEach((pid) => this.pids.add(pid))
    if (this.pids.size !== before && this.child) {
      this.setStatus({ ...this.status, pids: [...this.pids] })
    }
  }

  private flush(): void {
    if (this.batch.length === 0) return
    const batch = this.batch
    this.batch = []
    this.emit('entries', batch)
  }

  private clearTimers(): void {
    if (this.flushTimer) clearInterval(this.flushTimer)
    if (this.pidTimer) clearInterval(this.pidTimer)
    this.flushTimer = null
    this.pidTimer = null
  }

  private setStatus(status: LogcatStatus): void {
    this.status = status
    this.emit('status', status)
  }
}

export const logcatManager = new LogcatManager()
