# rn-devtools-client

SDK do [DevInspector](https://github.com/raphaelbiagi/DevInspector) para React Native e Expo. Instala-se dentro do app e envia requisições de rede, logs do console e consultas ao SQLite para o app desktop do DevInspector.

Você configura **uma vez por projeto**. O código fica commitado para sempre — em builds de produção o SDK é removido do bundle pelo próprio Metro, então não há nada para remover antes de subir para a `main`.

---

## Instalação

```bash
npm i -D github:raphaelbiagi/DevInspector#sdk-package
```

A branch `sdk-package` contém o pacote já compilado, publicado automaticamente a cada mudança no SDK. Como ela não tem `scripts`, o npm apenas baixa e instala — não compila nada na sua máquina.

Para atualizar depois:

```bash
npm update rn-devtools-client
```

---

## Configuração (uma vez por projeto)

São três arquivos. Copie e cole.

### 1. `src/devtools/sdk-stub.js`

Substitui o SDK em builds de produção. CommonJS puro e **sem nenhum import** — precisa funcionar mesmo que o pacote não esteja instalado (ex.: CI que roda `npm ci --omit=dev`).

```js
// Substitui `rn-devtools-client` em builds de produção.
// NÃO importe nada aqui.
'use strict'

const noop = () => {}

exports.DevProvider = ({ children }) => children
exports.DevToolsProvider = exports.DevProvider

exports.createExpoSqliteAdapter = () => ({
  getDatabases: async () => [],
  getTables: async () => [],
  executeSql: async () => []
})
exports.createSqliteStorageAdapter = exports.createExpoSqliteAdapter

const clienteInerte = {
  init: async () => {},
  destroy: noop,
  disconnect: noop,
  registerDatabaseDriver: noop,
  send: noop,
  sendEvent: noop,
  getHistory: () => [],
  subscribeHistory: () => noop,
  getStatus: () => 'disconnected',
  getBufferSize: () => 0,
  onStatusChange: () => noop
}

exports.devToolsClient = clienteInerte
// Classe também é exportada pelo SDK; cobrimos para o stub espelhar a API inteira.
exports.DevToolsClient = function DevToolsClient() {
  return clienteInerte
}

exports.useDevInspector = () => ({
  status: 'disconnected',
  bufferedEvents: 0,
  isConnected: false,
  isRetrying: false
})
```

### 2. `src/devtools/index.tsx`

O **único** arquivo do app que importa `rn-devtools-client`. Concentra toda a configuração, inclusive o banco.

Manter um só importador não é preferência de estilo: é o que mantém o stub acima pequeno e estável. Se o SDK fosse importado em vários lugares, o stub teria que espelhar a API inteira — e um import novo quebraria o build **só em produção**, com `undefined is not a function`.

```tsx
import React from 'react'
import * as SQLite from 'expo-sqlite'
import { DevProvider, devToolsClient, createExpoSqliteAdapter } from 'rn-devtools-client'

export function DevToolsRoot({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    if (!__DEV__) return

    devToolsClient.registerDatabaseDriver(
      createExpoSqliteAdapter({
        sqliteLib: SQLite,
        getDatabases: () => ['meu-app.db'] // ajuste para o nome do seu banco
      })
    )
  }, [])

  if (!__DEV__) return <>{children}</>

  return <DevProvider enabled={__DEV__}>{children}</DevProvider>
}
```

> O `if (!__DEV__) return` fica **dentro** do `useEffect`, não antes dele, para não violar as Rules of Hooks.

#### Listar os bancos automaticamente

Para varrer a pasta `SQLite/` em vez de manter a lista de bancos à mão, passe `fsLib` no lugar de `getDatabases`:

```tsx
import * as FileSystem from 'expo-file-system/legacy'

createExpoSqliteAdapter({ sqliteLib: SQLite, fsLib: FileSystem })
```

> **O `/legacy` é obrigatório a partir do SDK 54.** Em `expo-file-system@19` o import raiz passou a ser a API nova (`File`, `Directory`, `Paths`), que **não** exporta `documentDirectory` nem `readDirectoryAsync` — os dois métodos que o adapter usa. Importando de `'expo-file-system'` a varredura lança, o adapter captura, e você recebe uma lista de bancos vazia — o sintoma é o painel de banco em branco, com um `console.warn` do DevInspector como única pista. Em SDK 53 ou anterior, importe de `'expo-file-system'` normalmente.

### 3. `metro.config.js`

É isto que tira o SDK do bundle de produção.

```js
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const config = getDefaultConfig(projectRoot)

const DEVTOOLS_PKG = 'rn-devtools-client'
// realpathSync: o Metro exige caminho absoluto E real (resolvido de symlinks).
const DEVTOOLS_STUB = fs.realpathSync(path.resolve(projectRoot, 'src/devtools/sdk-stub.js'))

// IMPORTANTE: capturar o resolveRequest do Expo ANTES de sobrescrever.
// `context.resolveRequest` é o resolver padrão do METRO, não o do Expo —
// delegar para ele desliga em silêncio os paths do tsconfig (@/...) e a web.
const expoResolveRequest = config.resolver.resolveRequest

// Escape hatch: build de preview/dev-client que queira o DevInspector ligado.
const forceDevTools = process.env.DEVINSPECTOR === '1'

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const isDevTools = moduleName === DEVTOOLS_PKG || moduleName.startsWith(DEVTOOLS_PKG + '/')

  if (isDevTools && !context.dev && !forceDevTools) {
    return { type: 'sourceFile', filePath: DEVTOOLS_STUB }
  }

  return (expoResolveRequest ?? context.resolveRequest)(context, moduleName, platform)
}

module.exports = config
```

Se o app usa NativeWind, Sentry ou outro wrapper, este bloco entra **antes** da chamada final (`module.exports = withNativeWind(config, {...})`).

### 4. `app/_layout.tsx` — as linhas que ficam para sempre

```tsx
import { DevToolsRoot } from '@/src/devtools'

export default function RootLayout() {
  return (
    <DevToolsRoot>
      <Stack />
    </DevToolsRoot>
  )
}
```

Pronto. Nada mais a remover antes de subir para a `main`.

---

## Por que três camadas

| Camada | Onde | Garante |
|---|---|---|
| Resolução | `metro.config.js` | O pacote sai do **grafo** do Metro. É a única exclusão real do bundle. |
| Código morto | `if (!__DEV__)` no facade | O corpo é eliminado pelo minificador. |
| Runtime | `enabled` com default `__DEV__` | Rede de segurança se o `metro.config.js` for esquecido. |

A primeira camada é indispensável: **eliminar código morto não remove módulos do bundle**. A coleta de dependências do Metro é estática e acontece antes da minificação, então um `require('pacote')` dentro de `if (__DEV__)` tem o *chamador* podado, mas o módulo requerido continua no bundle inteiro. Só a resolução corta antes disso.

---

## Verificar que funcionou

Rode no diretório do app. Use **controle negativo e positivo** — um grep que retorna zero pode significar apenas que o grep está errado.

```bash
# NEGATIVO — o esperado em produção
npx expo export --platform android --no-bytecode --source-maps --output-dir dist-check
grep -rc "Procurando DevInspector Desktop na rede" dist-check/_expo/static/js/android/    # esperado: 0

# POSITIVO — prova que o grep encontraria, se estivesse lá
DEVINSPECTOR=1 npx expo export --platform android --no-bytecode --source-maps --output-dir dist-check-forced
grep -rc "Procurando DevInspector Desktop na rede" dist-check-forced/_expo/static/js/android/   # esperado: >= 1
```

Prova mais forte — o array `sources` do sourcemap lista todo módulo que entrou no grafo:

```bash
node -e "const fs=require('fs'),d='./dist-check/_expo/static/js/android/';const m=require(d+fs.readdirSync(d).find(f=>f.endsWith('.map')));console.log(m.sources.filter(s=>s.includes('rn-devtools-client')))"
# esperado: []
```

`--no-bytecode` é obrigatório para o grep valer: sem ele o Expo emite bytecode Hermes (`.hbc`), onde strings ASCII ainda aparecem mas a estrutura não — impossível distinguir "ausente" de "renomeado". Esse flag serve só para análise e nunca deve entrar no `eas.json`.

No PowerShell, use `Select-String` no lugar de `grep -rc` e `$env:DEVINSPECTOR='1'` no lugar do prefixo.

### Guarda permanente no CI (recomendado)

```yaml
- run: npx expo export --platform android --no-bytecode --output-dir dist-check
- name: DevInspector não pode estar no bundle
  run: |
    if grep -rq "Procurando DevInspector Desktop na rede" dist-check/_expo/static/js/android/; then
      echo "::error::DevInspector vazou para o bundle de produção"; exit 1
    fi
```

É isso que substitui a remoção manual por uma garantia automática — se alguém sobrescrever o `resolveRequest` depois (Sentry, `react-native-svg-transformer`), o build acusa.

---

## API

### `<DevProvider>`

| Prop | Padrão | Função |
|---|---|---|
| `enabled` | `__DEV__` | Liga o SDK. Desligado em produção por padrão. |
| `host` | auto-discovery | Fixa o IP do desktop, pulando a descoberta automática. |
| `port` | `8347` | Porta do servidor. |
| `showFloatingButton` | `false` | Bolha de debug dentro do app. |

### Adapters de banco

- `createExpoSqliteAdapter({ sqliteLib, getDatabases?, fsLib? })` — para `expo-sqlite`. Suporta streaming de resultados grandes.
- `createSqliteStorageAdapter({ sqliteLib, getDatabases?, fsLib?, customDbPath? })` — para `react-native-sqlite-storage`.

Ambos recebem a biblioteca por injeção: o SDK **não depende** de nenhuma lib de SQLite.

### `useDevInspector()`

Retorna `{ status, bufferedEvents, isConnected, isRetrying }` para exibir um indicador de conexão no app.

---

## Solução de problemas

**Não conecta em dispositivo físico** — confirme que celular e computador estão na mesma rede Wi-Fi e que a porta 8347 não está bloqueada pelo firewall.

**Não conecta no emulador Android** — normalmente funciona via `adb reverse`, que o desktop executa sozinho. Confirme que o `adb` está no PATH.

**Ainda assim falha** — fixe o IP: `<DevProvider host="192.168.0.105">`.

**Trocou USB por Wi-Fi** — aguarde alguns segundos; o SDK refaz a descoberta e reconecta.

**Quero o DevInspector num build de preview** — exporte `DEVINSPECTOR=1` no ambiente do build.

---

## Licença

MIT
