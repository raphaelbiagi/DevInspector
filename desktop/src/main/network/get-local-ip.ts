import * as os from 'os'

/**
 * Localiza o IPv4 válido da máquina local.
 * Ignora loopback e IPv6.
 * Fallback: 'localhost'
 */
export function getLocalIp(): string {
  const interfaces = os.networkInterfaces()

  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name]
    if (!netInterface) continue

    for (const info of netInterface) {
      // Ignora loopback e IPv6
      if (info.internal) continue
      if (info.family !== 'IPv4') continue

      return info.address
    }
  }

  return 'localhost'
}
