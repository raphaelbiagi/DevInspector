import { execFile } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Localiza o executável do adb. O PATH vem primeiro; depois as instalações
 * padrão do Android Studio, porque no Windows o SDK costuma ficar fora do PATH
 * e o Electron empacotado nem herda o PATH do terminal.
 */
function candidatePaths(): string[] {
  const exe = process.platform === 'win32' ? 'adb.exe' : 'adb'
  const candidates = ['adb']

  for (const sdkRoot of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
    if (sdkRoot) candidates.push(join(sdkRoot, 'platform-tools', exe))
  }

  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, 'Android', 'Sdk', 'platform-tools', exe))
  } else if (process.platform === 'darwin' && process.env.HOME) {
    candidates.push(join(process.env.HOME, 'Library', 'Android', 'sdk', 'platform-tools', exe))
  } else if (process.env.HOME) {
    candidates.push(join(process.env.HOME, 'Android', 'Sdk', 'platform-tools', exe))
  }

  // 'adb' puro é resolvido pelo PATH; os demais só valem se o arquivo existir.
  return candidates.filter((p) => p === 'adb' || existsSync(p))
}

function probe(adbPath: string): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(adbPath, ['version'], { timeout: 5000, windowsHide: true }, (err) => resolve(!err))
  })
}

// Só o sucesso fica em cache: se o adb não existir agora, o usuário pode
// instalar o SDK com o DevInspector aberto e a próxima chamada o encontra.
let cachedAdbPath: string | null = null

export async function resolveAdbPath(): Promise<string | null> {
  if (cachedAdbPath) return cachedAdbPath
  for (const candidate of candidatePaths()) {
    if (await probe(candidate)) {
      cachedAdbPath = candidate
      return candidate
    }
  }
  return null
}

export class AdbNotFoundError extends Error {
  constructor() {
    super('adb não encontrado. Instale o Android SDK Platform-Tools ou defina ANDROID_HOME.')
  }
}

export async function runAdb(args: string[], timeoutMs = 10000): Promise<string> {
  const adbPath = await resolveAdbPath()
  if (!adbPath) throw new AdbNotFoundError()

  return new Promise((resolve, reject) => {
    execFile(
      adbPath,
      args,
      { timeout: timeoutMs, windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(new Error((stderr || err.message).trim()))
          return
        }
        resolve(stdout)
      }
    )
  })
}
