import { generateUuid } from '../utils/uuid';
import { safeSerialize } from '../utils/serializer';
const originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    table: console.table
};
let originalConsoleLog = null;
let originalConsoleWarn = null;
let originalConsoleError = null;
let originalConsoleInfo = null;
let originalConsoleTable = null;
let originalErrorHandler = null;
let isTrackingErrors = false;
export function installConsoleInterceptor(client) {
    if (originalConsoleLog)
        return;
    originalConsoleLog = console.log;
    originalConsoleWarn = console.warn;
    originalConsoleError = console.error;
    originalConsoleInfo = console.info;
    originalConsoleTable = console.table;
    const createInterceptor = (level, original) => {
        return (...args) => {
            const serializedArgs = args.map(arg => safeSerialize(arg));
            client.send({
                type: 'console:log',
                payload: {
                    id: generateUuid(),
                    level,
                    args: serializedArgs,
                    timestamp: Date.now(),
                    stackTrace: level === 'error' ? new Error().stack || null : null
                }
            });
            original.apply(console, args);
        };
    };
    const interceptors = {
        log: createInterceptor('log', originalConsoleLog),
        warn: createInterceptor('warn', originalConsoleWarn),
        error: createInterceptor('error', originalConsoleError),
        info: createInterceptor('info', originalConsoleInfo),
        table: createInterceptor('table', originalConsoleTable)
    };
    console.log = interceptors.log;
    console.warn = interceptors.warn;
    console.error = interceptors.error;
    console.info = interceptors.info;
    console.table = interceptors.table;
    // --- STICKY INTERCEPTOR ---
    // O React Native (LogBox) sobrescreve o console.warn/error após a inicialização.
    // Este watcher garante que nós re-envolvemos qualquer nova sobrescrita, mantendo a captura.
    if (!global.__devInspectorConsoleWatcher) {
        ;
        global.__devInspectorConsoleWatcher = setInterval(() => {
            const methods = ['log', 'warn', 'error', 'info', 'table'];
            methods.forEach(method => {
                if (console[method] !== interceptors[method]) {
                    // Alguém (provavelmente o LogBox) sobrescreveu o console!
                    const newOriginal = console[method];
                    interceptors[method] = createInterceptor(method, newOriginal);
                    console[method] = interceptors[method];
                }
            });
        }, 1000);
    }
    // --- RASTREAMENTO GLOBAL DE CRASHES (Diferencial) ---
    if (!isTrackingErrors) {
        isTrackingErrors = true;
        // Captura exceções não tratadas no React Native
        if (global.ErrorUtils) {
            originalErrorHandler = global.ErrorUtils.getGlobalHandler();
            global.ErrorUtils.setGlobalHandler((error, isFatal) => {
                try {
                    const message = error instanceof Error ? error.message : String(error);
                    const stack = (error instanceof Error ? error.stack : null) ?? null;
                    client.send({
                        type: 'console:log',
                        payload: {
                            id: generateUuid(),
                            level: isFatal ? 'fatal' : 'error',
                            args: [
                                safeSerialize(`[Global Exception] ${isFatal ? '(Fatal) ' : ''}${message}`),
                                // O objeto de erro completo permite inspecionar campos customizados
                                // (código HTTP, causa, metadados) que a mensagem sozinha perderia.
                                safeSerialize({ isFatal: !!isFatal, stack, errorObject: error })
                            ],
                            timestamp: Date.now(),
                            stackTrace: stack
                        }
                    });
                }
                catch {
                    // Nunca deixar o logging impedir o tratamento de erro do React Native
                }
                if (originalErrorHandler) {
                    originalErrorHandler(error, isFatal);
                }
            });
        }
        // Tenta capturar Promessas rejeitadas não tratadas (funciona em alguns environments)
        if (typeof global !== 'undefined' && global.addEventListener) {
            global.addEventListener('unhandledrejection', (event) => {
                const error = event.reason || event;
                client.send({
                    type: 'console:log',
                    payload: {
                        id: generateUuid(),
                        level: 'error',
                        args: [safeSerialize(`[Unhandled Promise] ${error.message || error}`)],
                        timestamp: Date.now(),
                        stackTrace: error.stack || null
                    }
                });
            });
        }
    }
}
export function uninstallConsoleInterceptor() {
    if (originalConsoleLog) {
        console.log = originalConsoleLog;
        console.warn = originalConsoleWarn;
        console.error = originalConsoleError;
        console.info = originalConsoleInfo;
        console.table = originalConsoleTable;
        originalConsoleLog = null;
        originalConsoleWarn = null;
        originalConsoleError = null;
        originalConsoleInfo = null;
        originalConsoleTable = null;
    }
    if (global.__devInspectorConsoleWatcher) {
        clearInterval(global.__devInspectorConsoleWatcher);
        global.__devInspectorConsoleWatcher = null;
    }
    if (global.ErrorUtils && originalErrorHandler) {
        global.ErrorUtils.setGlobalHandler(originalErrorHandler);
        originalErrorHandler = null;
        isTrackingErrors = false;
    }
}
//# sourceMappingURL=consoleInterceptor.js.map