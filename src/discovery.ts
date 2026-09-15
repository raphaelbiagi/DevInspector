/**
 * DevInspector Discovery — Localiza automaticamente o Desktop na rede local
 *
 * React Native não expõe sockets UDP, então o cliente descobre o desktop por
 * HTTP probing: testa candidatos em paralelo no endpoint `/ping` e fica com o
 * primeiro que responder. (O desktop também mantém um servidor de discovery UDP
 * na porta 41234, usado por outros clientes — não por este.)
 *
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

const DISCOVERY_TIMEOUT_MS = 3000

/**
 * Tenta descobrir o DevInspector Desktop na rede local.
 * Retorna null se não encontrar dentro do timeout.
 */
export async function discoverDesktop(lifesaverIp?: string | null): Promise<DiscoveryResult | null> {
  // Em React Native, não temos acesso direto a UDP sockets
  // A estratégia é tentar conectar em candidatos conhecidos

  const candidates = getCandidateHosts()
  if (lifesaverIp && !candidates.includes(lifesaverIp)) {
    candidates.push(lifesaverIp)
  }
  
  const port = 8347 // Porta padrão do DevInspector

  // Testa todos os candidatos em paralelo e fica com o PRIMEIRO A RESPONDER.
  // Percorrer os resultados na ordem do array faria `localhost` vencer sempre,
  // mesmo quando o alvo correto é a máquina na rede.
  return raceToFirstHit(candidates.map(host => probeHost(host, port)))
}

/**
 * Resolve com o primeiro probe bem-sucedido, ou null quando todos falharem.
 * Escrito à mão em vez de `Promise.any` porque `any` rejeita com AggregateError
 * e nem toda engine JS embarcada em RN o expõe.
 */
function raceToFirstHit(
  probes: Array<Promise<DiscoveryResult | null>>
): Promise<DiscoveryResult | null> {
  return new Promise((resolve) => {
    let pending = probes.length
    let settled = false

    if (pending === 0) {
      resolve(null)
      return
    }

    for (const probe of probes) {
      probe
        .then((result) => {
          if (result && !settled) {
            settled = true
            resolve(result)
          }
        })
        .catch(() => {
          // probeHost já engole os próprios erros; aqui é só defesa
        })
        .then(() => {
          pending--
          if (pending === 0 && !settled) {
            settled = true
            resolve(null)
          }
        })
    }
  })
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
        let ip = match[1]
        console.log('[DevInspector] IP encontrado via scriptURL:', ip)
        return ip
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
        let ip = match[1]
        console.log('[DevInspector] IP encontrado via Expo Constants:', ip)
        return ip
      }
    }
  } catch (e) {
    // Ignora se expo-constants não existir
  }

  console.log('[DevInspector] AVISO: Não foi possível detectar o IP. Usando fallback.')
  return 'localhost'
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

    // Endpoint customizado para HTTP probing do WebSocket nativo
    const url = `http://${host}:${port}/ping`

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
