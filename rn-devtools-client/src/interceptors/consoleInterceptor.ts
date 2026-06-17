import { DevToolsClient } from '../DevToolsClient'
import { generateUuid } from '../utils/uuid'
import { safeSerialize } from '../utils/serializer'
import { LogLevel } from '../types'

const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  table: console.table
}


let originalConsoleLog: any = null
let originalConsoleWarn: any = null
let originalConsoleError: any = null
let originalConsoleInfo: any = null
let originalConsoleTable: any = null

let originalErrorHandler: any = null
let isTrackingErrors = false

export function installConsoleInterceptor(client: DevToolsClient) {
  if (originalConsoleLog) return

  originalConsoleLog = console.log
  originalConsoleWarn = console.warn
  originalConsoleError = console.error
  originalConsoleInfo = console.info
  originalConsoleTable = console.table

  const createInterceptor = (level: 'log' | 'warn' | 'error' | 'info' | 'table', original: any) => {
    return (...args: any[]) => {
      const serializedArgs = args.map(arg => safeSerialize(arg))

      client.send({
        type: 'console:log',
        payload: {
          id: generateUuid(),
          level,
          args: serializedArgs,
          timestamp: Date.now(),
          stackTrace: level === 'error' ? new Error().stack || null : null
        }
      })

      original.apply(console, args)
    }
  }

  const interceptors = {
    log: createInterceptor('log', originalConsoleLog),
    warn: createInterceptor('warn', originalConsoleWarn),
    error: createInterceptor('error', originalConsoleError),
    info: createInterceptor('info', originalConsoleInfo),
    table: createInterceptor('table', originalConsoleTable)
  }

  console.log = interceptors.log
  console.warn = interceptors.warn
  console.error = interceptors.error
  console.info = interceptors.info
  console.table = interceptors.table

  // --- STICKY INTERCEPTOR ---
  // O React Native (LogBox) sobrescreve o console.warn/error após a inicialização.
  // Este watcher garante que nós re-envolvemos qualquer nova sobrescrita, mantendo a captura.
  if (!(global as any).__devInspectorConsoleWatcher) {
    ;(global as any).__devInspectorConsoleWatcher = setInterval(() => {
      const methods = ['log', 'warn', 'error', 'info', 'table'] as const
      methods.forEach(method => {
        if (console[method] !== interceptors[method]) {
          // Alguém (provavelmente o LogBox) sobrescreveu o console!
          const newOriginal = console[method]
          interceptors[method] = createInterceptor(method, newOriginal)
          console[method] = interceptors[method]
        }
      })
    }, 1000)
  }

  // --- RASTREAMENTO GLOBAL DE CRASHES (Diferencial) ---
  if (!isTrackingErrors) {
    isTrackingErrors = true
    
    // Captura exceções não tratadas no React Native
    if ((global as any).ErrorUtils) {
      originalErrorHandler = (global as any).ErrorUtils.getGlobalHandler()
      ;(global as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
        client.send({
          type: 'console:log',
          payload: {
            id: generateUuid(),
            level: isFatal ? 'fatal' : 'error',
            args: [safeSerialize(`[Global Exception] ${error.message || error}`)],
            timestamp: Date.now(),
            stackTrace: error.stack || null
          }
        })
        if (originalErrorHandler) {
          originalErrorHandler(error, isFatal)
        }
      })
    }

    // Tenta capturar Promessas rejeitadas não tratadas (funciona em alguns environments)
    if (typeof global !== 'undefined' && (global as any).addEventListener) {
      (global as any).addEventListener('unhandledrejection', (event: any) => {
        const error = event.reason || event
        client.send({
          type: 'console:log',
          payload: {
            id: generateUuid(),
            level: 'error',
            args: [safeSerialize(`[Unhandled Promise] ${error.message || error}`)],
            timestamp: Date.now(),
            stackTrace: error.stack || null
          }
        })
      })
    }
  }
}

export function uninstallConsoleInterceptor() {
  if (originalConsoleLog) {
    console.log = originalConsoleLog
    console.warn = originalConsoleWarn
    console.error = originalConsoleError
    console.info = originalConsoleInfo
    console.table = originalConsoleTable

    originalConsoleLog = null
    originalConsoleWarn = null
    originalConsoleError = null
    originalConsoleInfo = null
    originalConsoleTable = null
  }
  
  if ((global as any).__devInspectorConsoleWatcher) {
    clearInterval((global as any).__devInspectorConsoleWatcher)
    ;(global as any).__devInspectorConsoleWatcher = null
  }
  
  if ((global as any).ErrorUtils && originalErrorHandler) {
    (global as any).ErrorUtils.setGlobalHandler(originalErrorHandler)
    originalErrorHandler = null
    isTrackingErrors = false
  }
}
