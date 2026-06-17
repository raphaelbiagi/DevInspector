/**
 * DevInspector Discovery — Localiza automaticamente o Desktop na rede local
 *
 * Usa UDP broadcast na porta 41234.
 * Funciona em:
 * - iOS Simulator (compartilha rede do host)
 * - Android Emulator (fallback 10.0.2.2)
 * - Dispositivos físicos (mesma subnet Wi-Fi)
 */

import { Platform, NativeModules } from 'react-native'

export interface DiscoveryResult {
  host: string
  port: number
  machineName: string
}

const DISCOVERY_PORT = 41234
const DISCOVERY_MESSAGE = 'DISCOVER_DEVINSPECTOR'
const DISCOVERY_TIMEOUT_MS = 3000

/**
 * Tenta descobrir o DevInspector Desktop na rede local.
 * Retorna null se não encontrar dentro do timeout.
 */
export async function discoverDesktop(): Promise<DiscoveryResult | null> {
  // Em React Native, não temos acesso direto a UDP sockets
  // A estratégia é tentar conectar em candidatos conhecidos

  const candidates = getCandidateHosts()
  const port = 8347 // Porta padrão do DevInspector

  // Tenta cada candidato em paralelo com timeout
  const results = await Promise.allSettled(
    candidates.map(host => probeHost(host, port))
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value !== null) {
      return result.value
    }
  }

  return null
}

/**
 * Retorna lista de IPs candidatos para testar, baseado na plataforma.
 */
export function getFallbackHost(): string {
  console.log('[DevInspector] Tentando descobrir IP automaticamente...')

  // 1. Tentar ler do Metro Bundler nativo
  try {
    const sourceCode = NativeModules.SourceCode
    
    // Algumas versões/ambientes do React Native envelopam as constantes dentro dessa função
    const constants = typeof sourceCode?.getConstants === 'function' 
      ? sourceCode.getConstants() 
      : sourceCode;
      
    console.log('[DevInspector] SourceCode Constants:', constants)
    
    if (constants && constants.scriptURL) {
      const match = constants.scriptURL.match(/(?:http|exp)s?:\/\/([^:/]+)/)
      console.log('[DevInspector] Regex match:', match)
      if (match && match[1]) {
        console.log('[DevInspector] IP encontrado via scriptURL:', match[1])
        return match[1]
      }
    }
  } catch (e) {
    console.log('[DevInspector] Erro ao ler scriptURL:', e)
  }

  // 2. Tentar ler do Expo Constants (útil se estiver no Expo Go)
  try {
    // Como não temos expo-constants como dependência fixa, exigimos dinamicamente
    const Constants = require('expo-constants').default
    const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest?.debuggerHost || Constants?.manifest2?.extra?.expoGo?.debuggerHost
    console.log('[DevInspector] Expo hostUri:', hostUri)
    
    if (hostUri) {
      const match = hostUri.match(/^([^:/]+)/)
      if (match && match[1]) {
        console.log('[DevInspector] IP encontrado via Expo Constants:', match[1])
        return match[1]
      }
    }
  } catch (e) {
    // Ignora se expo-constants não existir
  }

  console.log('[DevInspector] AVISO: Não foi possível detectar o IP. Usando fallback.')
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
}

function getCandidateHosts(): string[] {
  const hosts: Set<string> = new Set()

  // 1. IP dinâmico do Metro Bundler
  const fallback = getFallbackHost()
  hosts.add(fallback)

  // 2. Fallbacks locais padrão
  hosts.add('localhost')
  hosts.add('127.0.0.1')

  // 3. Android emulator fallbacks
  if (Platform.OS === 'android') {
    hosts.add('10.0.2.2') // Emulador Android Padrão
    hosts.add('10.0.3.2') // Genymotion
  }

  return Array.from(hosts)
}

/**
 * Testa se um host tem o DevInspector escutando na porta informada.
 * Faz uma requisição HTTP simples ao servidor Socket.IO.
 */
async function probeHost(host: string, port: number): Promise<DiscoveryResult | null> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS)

    // Socket.IO server expõe um endpoint de polling que podemos usar para probing
    const url = `http://${host}:${port}/socket.io/?EIO=4&transport=polling`

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok || response.status === 200) {
      return {
        host,
        port,
        machineName: host,
      }
    }
  } catch {
    // Host não disponível — silencioso
  }

  return null
}
