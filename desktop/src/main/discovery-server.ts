import * as dgram from 'dgram'
import * as os from 'os'
import { getLocalIp } from './network/get-local-ip'
import { PROTOCOL_VERSION } from './protocol'

const DISCOVERY_PORT = 41234
const DISCOVERY_MESSAGE = 'DISCOVER_DEVINSPECTOR'

interface DiscoveryResponse {
  app: string
  version: string
  host: string
  port: number
  machineName: string
}

export class DiscoveryServer {
  private server: dgram.Socket | null = null
  private socketPort: number

  constructor(socketPort: number) {
    this.socketPort = socketPort
  }

  start(): void {
    try {
      this.server = dgram.createSocket({ type: 'udp4', reuseAddr: true })

      this.server.on('message', (msg, rinfo) => {
        const message = msg.toString().trim()

        if (message === DISCOVERY_MESSAGE) {
          const response: DiscoveryResponse = {
            app: 'DevInspector',
            version: PROTOCOL_VERSION,
            host: getLocalIp(),
            port: this.socketPort,
            machineName: os.hostname()
          }

          const responseBuffer = Buffer.from(JSON.stringify(response))
          this.server?.send(responseBuffer, rinfo.port, rinfo.address, (err) => {
            if (err) {
              console.error('[DevInspector] Discovery response error:', err.message)
            }
          })
        }
      })

      this.server.on('error', (err) => {
        console.error('[DevInspector] Discovery server error:', err.message)
        // Não crashar — discovery é best-effort
        this.server?.close()
        this.server = null
      })

      this.server.bind(DISCOVERY_PORT, '0.0.0.0', () => {
        this.server?.setBroadcast(true)
        console.log(`[DevInspector] Discovery server listening on UDP port ${DISCOVERY_PORT}`)
      })
    } catch (err) {
      console.error('[DevInspector] Failed to start discovery server:', err)
    }
  }

  stop(): void {
    this.server?.close()
    this.server = null
  }
}
