# DevInspector

DevTools externo para React Native e Expo. Roda como um app desktop e se conecta ao seu app em execução para inspecionar **requisições de rede**, **logs do console** e **o banco de dados SQLite do dispositivo** — sem depender do Flipper e sem abrir o Chrome DevTools.

## O que ele faz

| Painel | O que entrega |
|---|---|
| **Network** | Lista virtualizada de requisições (fetch e XHR), filtros por método e status, busca em URL/headers/body, detalhe com headers, payload, response e timing, waterfall, copiar como cURL, diff com a chamada anterior da mesma rota |
| **Console** | `log`, `info`, `warn`, `error` e `table` com contadores por nível, busca, stack trace expansível e captura de crashes e promises rejeitadas |
| **Insights** | Detecção automática de anomalias: requisições lentas, respostas grandes, status 4xx/5xx e floods de log repetido |
| **Database** | Explorador de SQLite — tabelas do app conectado *ou* arquivos `.db` abertos direto no desktop, com grid paginado, editor SQL com syntax highlight e queries salvas |

## Instalação

O projeto tem duas partes: o **app desktop** e o **SDK** que você instala no seu app React Native.

### 1. App desktop

```bash
cd desktop
npm install
npm run dev          # desenvolvimento
npm run dist         # gera o instalador (Windows/NSIS)
```

### 2. SDK no seu app React Native

```bash
npm i -D github:raphaelbiagi/DevInspector#sdk-package
```

A branch `sdk-package` traz o SDK já compilado e é republicada automaticamente a cada mudança. Atualizar depois: `npm update rn-devtools-client`.

Envolva seu app com o provider:

```tsx
import { DevProvider } from 'rn-devtools-client'

export default function App() {
  return (
    <DevProvider>
      <YourApp />
    </DevProvider>
  )
}
```

É isso. O SDK descobre o desktop sozinho — testa o IP do Metro, `localhost`, e os endereços de emulador (`10.0.2.2`, `10.0.3.2`) em paralelo, ficando com o primeiro que responder. E `enabled` já vem como `__DEV__`, então ele se desliga sozinho em produção.

> **Para deixar o DevInspector commitado no projeto para sempre** — sem precisar remover antes de subir para a `main` — siga o guia de configuração em [rn-devtools-client/README.md](rn-devtools-client/README.md). São três arquivos que fazem o Metro excluir o SDK do bundle de produção.

#### Opções do provider

| Prop | Padrão | Para que serve |
|---|---|---|
| `enabled` | `true` | Desliga o SDK por completo |
| `host` | auto-discovery | Fixa o IP do desktop, pulando a descoberta automática |
| `port` | `8347` | Porta do servidor |
| `showFloatingButton` | `false` | Exibe a bolha de debug dentro do próprio app |

### 3. Inspeção do banco de dados (opcional)

O SDK não depende de nenhuma biblioteca de SQLite — você injeta a que já usa.

**Expo SQLite:**

```tsx
import * as SQLite from 'expo-sqlite'
import * as FileSystem from 'expo-file-system'
import { devToolsClient, createExpoSqliteAdapter } from 'rn-devtools-client'

devToolsClient.registerDatabaseDriver(
  createExpoSqliteAdapter({
    sqliteLib: SQLite,
    fsLib: FileSystem,                    // varre a pasta SQLite/ automaticamente
    // ou liste os bancos manualmente:
    // getDatabases: () => ['app.db', 'cache.db']
  })
)
```

**react-native-sqlite-storage:**

```tsx
import SQLite from 'react-native-sqlite-storage'
import { devToolsClient, createSqliteStorageAdapter } from 'rn-devtools-client'

devToolsClient.registerDatabaseDriver(
  createSqliteStorageAdapter({ sqliteLib: SQLite, getDatabases: () => ['app.db'] })
)
```

### 4. Indicador de conexão no app (opcional)

```tsx
import { useDevInspector } from 'rn-devtools-client'

function DevIndicator() {
  const { isConnected, bufferedEvents } = useDevInspector()
  return <View style={{ backgroundColor: isConnected ? 'green' : 'gray' }} />
}
```

## Atalhos do desktop

| Atalho | Ação |
|---|---|
| `Ctrl/Cmd + K` | Paleta de comandos |
| `/` | Foca a busca do painel Network |
| `j` / `↓` e `k` / `↑` | Navega entre requisições |
| `Ctrl + Enter` | Executa a query no editor SQL |

## Exportando dados

Pelo ícone de download na barra lateral:

- **JSON** — rede, console e anomalias no formato do DevInspector.
- **HAR** — formato padrão da indústria, abre no Chrome DevTools, Insomnia, Postman e Charles.

## Conexão: como funciona

O desktop sobe um servidor WebSocket na porta **8347** e um servidor de discovery UDP na **41234**. Para Android, roda `adb reverse tcp:8347 tcp:8347` automaticamente a cada 10 segundos, o que faz a conexão via USB funcionar sem configuração.

Payloads acima de 1,5 MB não passam pelo WebSocket: o SDK os envia por `POST /upload-payload`, evitando travar a thread JS do app.

### Não conecta?

1. **Dispositivo físico:** confirme que o celular e o computador estão na mesma rede Wi-Fi. Se o firewall bloquear, libere a porta 8347.
2. **Emulador Android:** normalmente funciona por `adb reverse`. Confirme que o `adb` está no PATH — em Windows, o DevInspector também procura em `%LOCALAPPDATA%\Android\Sdk\platform-tools`.
3. **Ainda assim falha:** fixe o IP manualmente com `<DevProvider host="192.168.0.105">`.
4. **Trocou de USB para Wi-Fi:** aguarde alguns segundos — o SDK refaz a descoberta e reconecta sozinho.

## Desenvolvimento

```
DevInspector/
├── desktop/              App Electron (electron-vite + React 19 + Zustand)
│   └── src/
│       ├── main/         Servidor WebSocket, discovery, anomalias, diff, sessões, SQLite local
│       ├── preload/      Ponte contextIsolation → window.devInspector
│       └── renderer/     UI: components/, stores/, hooks/
└── rn-devtools-client/   SDK que roda dentro do app RN
    └── src/
        ├── interceptors/ fetch, XHR, console
        └── plugins/      Adapters de banco de dados
```

Verificação de tipos:

```bash
cd desktop            && npm run typecheck
cd rn-devtools-client && npm run typecheck
```

## Licença

MIT
