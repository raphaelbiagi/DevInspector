import React, { useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useLogcatStore } from '../../stores/logcatStore'
import { LogcatRow } from './LogcatRow'

export const LogcatList: React.FC = () => {
  const entries = useLogcatStore(useShallow((state) => state.getFilteredEntries()))
  const totalCount = useLogcatStore((state) => state.entries.length)
  const status = useLogcatStore((state) => state.status)
  const devices = useLogcatStore((state) => state.devices)
  const devicesError = useLogcatStore((state) => state.devicesError)
  const sortOrder = useLogcatStore((state) => state.sortOrder)
  const parentRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 21,
    overscan: 30,
  })

  // Auto-scroll: segue a ponta onde chegam as linhas novas — embaixo em ordem
  // crescente, no topo em decrescente — enquanto o usuário estiver nela.
  const [autoScroll, setAutoScroll] = React.useState(true)
  const lastCount = useRef(entries.length)

  useEffect(() => {
    setAutoScroll(true)
    if (entries.length) rowVirtualizer.scrollToIndex(sortOrder === 'asc' ? entries.length - 1 : 0, { align: sortOrder === 'asc' ? 'end' : 'start' })
  }, [sortOrder])

  useEffect(() => {
    if (autoScroll && entries.length > lastCount.current) {
      if (sortOrder === 'asc') rowVirtualizer.scrollToIndex(entries.length - 1, { align: 'end' })
      else rowVirtualizer.scrollToIndex(0, { align: 'start' })
    }
    lastCount.current = entries.length
  }, [entries.length, autoScroll])

  const handleScroll = () => {
    if (!parentRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current
    const atLiveEdge = sortOrder === 'asc' ? scrollHeight - scrollTop - clientHeight < 50 : scrollTop < 50
    setAutoScroll(atLiveEdge)
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
    {entries.length > 0 && (
      // Fora do contêiner rolável para não interferir nas posições do virtualizer.
      <div className="logcat-row logcat-header">
        <span className="logcat-time">Data/hora</span>
        <span className="logcat-pid" title="Número do processo e da thread que escreveram a linha">Processo</span>
        <span className="logcat-level" title="Nível de gravidade">Nív.</span>
        <span className="logcat-tag" title="A tag: quem escreveu a linha (biblioteca, sistema ou seu app)">Origem</span>
        <span className="logcat-message">Mensagem</span>
      </div>
    )}
    <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-primary)' }} ref={parentRef} onScroll={handleScroll}>
      {entries.length === 0 ? (
        <EmptyState
          devicesError={devicesError}
          hasDevices={devices.length > 0}
          running={status.running}
          waitingForProcess={status.running && !!status.packageName && status.pids.length === 0}
          packageName={status.packageName}
          filteredOut={totalCount > 0}
        />
      ) : (
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => {
            const entry = entries[virtualItem.index]
            return (
              <div
                key={entry.id}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualItem.start}px)`,
                }}
                ref={rowVirtualizer.measureElement}
                data-index={virtualItem.index}
              >
                <LogcatRow entry={entry} />
              </div>
            )
          })}
        </div>
      )}
    </div>
    </div>
  )
}

interface EmptyStateProps {
  devicesError: string | null
  hasDevices: boolean
  running: boolean
  waitingForProcess: boolean
  packageName: string | null
  filteredOut: boolean
}

// Cada causa de lista vazia tem uma ação diferente; mostrar só "nenhum log"
// deixaria o usuário sem saber se o problema é o adb, o cabo ou o filtro.
const EmptyState: React.FC<EmptyStateProps> = ({ devicesError, hasDevices, running, waitingForProcess, packageName, filteredOut }) => {
  let title = 'Logcat parado'
  let subtitle =
    'Clique em Iniciar: chegam as últimas 1.000 linhas do aparelho e, depois, as novas ao vivo, até você clicar em Parar. ' +
    'Deixe o pacote vazio para ver todos os processos.'

  if (devicesError) {
    title = 'Não foi possível usar o adb'
    subtitle = devicesError
  } else if (!hasDevices) {
    title = 'Nenhum dispositivo Android'
    subtitle = 'Conecte um aparelho com depuração USB ativa (ou inicie um emulador) e clique em atualizar.'
  } else if (filteredOut) {
    title = 'Nenhuma linha corresponde ao filtro'
    subtitle = 'Ajuste o nível mínimo ou a busca.'
  } else if (waitingForProcess) {
    title = `Aguardando ${packageName} iniciar`
    subtitle = 'O processo do app não está rodando. As linhas aparecem assim que ele abrir.'
  } else if (running) {
    title = 'Capturando…'
    subtitle = 'Nenhuma linha recebida ainda.'
  }

  return (
    <div className="empty-state">
      <div className="empty-icon">🤖</div>
      <div>{title}</div>
      <div className="empty-subtitle">{subtitle}</div>
    </div>
  )
}
