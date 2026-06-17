import { DevToolsClient } from '../DevToolsClient'
import { generateUuid } from '../utils/uuid'
import { safeSerialize } from '../utils/serializer'

let isInstalled = false
let originalErrorHandler: any = null

export function installErrorInterceptor(client: DevToolsClient) {
  if (isInstalled) return

  const globalErrorUtils = (global as any).ErrorUtils
  if (globalErrorUtils && typeof globalErrorUtils.getGlobalHandler === 'function') {
    isInstalled = true
    originalErrorHandler = globalErrorUtils.getGlobalHandler()

    globalErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      try {
        const errorMessage = error instanceof Error ? error.message : String(error)
        const stackTrace = error instanceof Error ? error.stack : null

        client.send({
          type: 'console:log',
          payload: {
            id: generateUuid(),
            level: 'error',
            args: [
              safeSerialize(`[Unhandled Exception] ${isFatal ? '(Fatal) ' : ''}${errorMessage}`),
              safeSerialize({
                isFatal,
                stack: stackTrace,
                errorObject: error
              })
            ],
            timestamp: Date.now(),
            stackTrace: stackTrace || null
          }
        })
      } catch (e) {
        // Prevent logging crash from blocking React Native's error handling
      }

      // Execute original React Native error handler (like showing LogBox / RedBox screen)
      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal)
      }
    })
  }
}

export function uninstallErrorInterceptor() {
  if (!isInstalled) return

  const globalErrorUtils = (global as any).ErrorUtils
  if (globalErrorUtils && originalErrorHandler) {
    globalErrorUtils.setGlobalHandler(originalErrorHandler)
  }

  isInstalled = false
  originalErrorHandler = null
}
