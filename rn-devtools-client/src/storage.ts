/**
 * Cache local de host para evitar discovery a cada inicialização.
 * Usa AsyncStorage no React Native.
 */

const STORAGE_KEY = '@devinspector/host_cache'

export interface HostCache {
  host: string
  port: number
  lastSeen: number
}

// Tempo máximo para considerar o cache válido (24 horas)
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Salva informações do host encontrado.
 */
export async function saveHostCache(host: string, port: number): Promise<void> {
  try {
    const cache: HostCache = {
      host,
      port,
      lastSeen: Date.now()
    }

    const AsyncStorage = await getAsyncStorage()
    if (AsyncStorage) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache))
    }
  } catch {
    // Silencioso — cache é best-effort
  }
}

/**
 * Carrega informações do último host conhecido.
 * Retorna null se o cache expirou ou não existe.
 */
export async function loadHostCache(): Promise<HostCache | null> {
  try {
    const AsyncStorage = await getAsyncStorage()
    if (!AsyncStorage) return null

    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    if (!raw) return null

    const cache: HostCache = JSON.parse(raw)

    // Verifica se o cache ainda é válido
    if (Date.now() - cache.lastSeen > CACHE_TTL_MS) {
      await AsyncStorage.removeItem(STORAGE_KEY)
      return null
    }

    return cache
  } catch {
    return null
  }
}

/**
 * Limpa o cache de host.
 */
export async function clearHostCache(): Promise<void> {
  try {
    const AsyncStorage = await getAsyncStorage()
    if (AsyncStorage) {
      await AsyncStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Silencioso
  }
}

/**
 * Tenta importar AsyncStorage dinamicamente.
 * Retorna null se não disponível (ex: ambiente de teste).
 */
async function getAsyncStorage(): Promise<any | null> {
  try {
    // @react-native-async-storage/async-storage é peer dependency opcional
    const mod = require('@react-native-async-storage/async-storage')
    return mod.default || mod
  } catch {
    // Fallback: tenta usar global.__DEV__ storage ou retorna null
    return null
  }
}
