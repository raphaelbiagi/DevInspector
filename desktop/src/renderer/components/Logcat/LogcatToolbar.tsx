import React, { useState } from 'react'
import { Ban, Play, Square, RefreshCw, ArrowDownNarrowWide, ArrowUpNarrowWide, HelpCircle, X } from 'lucide-react'
import { FilterChips } from '../shared/FilterChips'
import { SearchInput } from '../shared/SearchInput'
import { useLogcatStore } from '../../stores/logcatStore'
import { LOGCAT_LEVELS, LOGCAT_LEVEL_INFO } from '../../utils/logcatFilter'
import type { LogcatLevel } from '../../types/logcat'

export const LogcatToolbar: React.FC = () => {
  const {
    devices,
    packages,
    selectedSerial,
    packageName,
    status,
    filter,
    sortOrder,
    refreshDevices,
    selectDevice,
    setPackageName,
    toggleLevel,
    setAllLevels,
    setSearch,
    setSortOrder,
    start,
    stop,
    clear,
    getLevelCounts
  } = useLogcatStore()
  const [showHelp, setShowHelp] = useState(false)

  const counts = getLevelCounts()
  const levelChips = LOGCAT_LEVELS.map((level) => ({
    label: LOGCAT_LEVEL_INFO[level].label,
    value: level,
    count: counts[level],
    title: LOGCAT_LEVEL_INFO[level].hint
  }))

  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            className="logcat-select"
            value={selectedSerial ?? ''}
            onChange={(e) => selectDevice(e.target.value || null)}
            disabled={status.running}
            title="Dispositivo"
          >
            {devices.length === 0 && <option value="">Nenhum dispositivo</option>}
            {devices.map((d) => (
              <option key={d.serial} value={d.serial} disabled={d.state !== 'device'}>
                {d.model ?? d.serial}
                {d.state !== 'device' ? ` (${d.state})` : ''}
              </option>
            ))}
          </select>
          <button className="btn btn-icon" onClick={() => refreshDevices()} title="Atualizar dispositivos" disabled={status.running}>
            <RefreshCw size={14} />
          </button>

          <input
            className="logcat-input"
            list="logcat-packages"
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            placeholder="Pacote (vazio = todos)"
            disabled={status.running}
            spellCheck={false}
          />
          <datalist id="logcat-packages">
            {packages.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          {status.running ? (
            <button className="btn" onClick={() => stop()}>
              <Square size={12} /> Parar
            </button>
          ) : (
            <button
              className="btn btn-accent"
              onClick={() => start()}
              disabled={!selectedSerial}
              title="Traz as últimas 1.000 linhas do aparelho e continua recebendo as novas ao vivo, até você clicar em Parar"
            >
              <Play size={12} /> Iniciar
            </button>
          )}
        </div>

        <StatusLabel />
      </div>

      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Níveis</span>
          <FilterChips
            mode="multi"
            chips={levelChips}
            activeValues={filter.levels}
            onChange={(v) => toggleLevel(v as LogcatLevel)}
          />
          {filter.levels.size < LOGCAT_LEVELS.length && (
            <button className="btn" onClick={setAllLevels} title="Ligar todos os níveis de novo">
              Todos
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            title="Alternar a ordem por data e hora"
          >
            {sortOrder === 'asc' ? <ArrowDownNarrowWide size={14} /> : <ArrowUpNarrowWide size={14} />}
            {sortOrder === 'asc' ? 'Mais antigos primeiro' : 'Mais recentes primeiro'}
          </button>
          <SearchInput
            value={filter.search}
            onChange={setSearch}
            placeholder="Filtrar (tag:Nome, -excluir)..."
          />
          <button className="btn btn-icon" onClick={clear} title="Limpar Logcat" style={{ opacity: 0.6 }}>
            <Ban size={16} />
          </button>
          <button
            className="btn btn-icon"
            onClick={() => setShowHelp((v) => !v)}
            title="O que é o logcat e como ler esta tela"
            style={{ opacity: showHelp ? 1 : 0.6, color: showHelp ? 'var(--color-accent)' : undefined }}
          >
            <HelpCircle size={16} />
          </button>
        </div>
      </div>

      {showHelp && <LogcatHelp onClose={() => setShowHelp(false)} />}
    </>
  )
}

// Primeiro contato com logcat costuma ser confuso: é o log do Android inteiro,
// não só do app, e cada coluna tem um significado que não é óbvio.
const LogcatHelp: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="logcat-help">
    <button className="btn btn-icon" onClick={onClose} title="Fechar" style={{ position: 'absolute', top: 8, right: 8 }}>
      <X size={14} />
    </button>
    <div className="logcat-help-section">
      <strong>O que é o logcat</strong>
      <p>
        É o log do Android inteiro: o seu app, as bibliotecas nativas e o próprio sistema escrevem nele. Ele mostra o
        que o Console não consegue, como crashes nativos e erros de módulos Java/Kotlin. Preencha o <b>pacote</b> do seu
        app para ver só o processo dele; com o campo vazio aparece tudo o que roda no aparelho.
      </p>
    </div>
    <div className="logcat-help-section">
      <strong>Colunas</strong>
      <p>
        <b>Data/hora</b> do aparelho · <b>Processo</b> (PID-TID: número do processo e da thread) · <b>Nível</b> (letra
        colorida) · <b>Origem</b> (a "tag": quem escreveu a linha) · <b>Mensagem</b>.
      </p>
    </div>
    <div className="logcat-help-section">
      <strong>Níveis</strong>
      <p>
        Clique para ligar ou desligar cada um. Do mais ao menos grave: <b>Fatal</b>, <b>Erro</b>, <b>Aviso</b>, <b>Info</b>,{' '}
        <b>Debug</b> e <b>Detalhado</b>. Para começar, desligue Detalhado e Debug, que são os mais barulhentos.
      </p>
    </div>
    <div className="logcat-help-section">
      <strong>Dicas</strong>
      <p>
        O <code>console.log</code> do JS aparece com a origem <code>ReactNativeJS</code>. Um crash aparece como{' '}
        <code>FATAL EXCEPTION</code> com a origem <code>AndroidRuntime</code>, e o DevInspector mostra um aviso. Na busca,{' '}
        <code>tag:ReactNativeJS</code> filtra pela origem e <code>-palavra</code> esconde as linhas com aquela palavra.
      </p>
    </div>
  </div>
)

const StatusLabel: React.FC = () => {
  const status = useLogcatStore((state) => state.status)
  const total = useLogcatStore((state) => state.entries.length)

  if (status.error) {
    return (
      <span style={{ fontSize: 12, color: 'var(--color-error)', maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={status.error}>
        {status.error}
      </span>
    )
  }
  const lines = `${total.toLocaleString('pt-BR')} linhas`

  if (!status.running) {
    return total > 0
      ? <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Parado · {lines}</span>
      : null
  }

  let text = 'todos os processos'
  if (status.packageName) {
    text = status.pids.length
      ? `${status.packageName} · PID ${status.pids.join(', ')}`
      : `aguardando ${status.packageName} iniciar`
  }

  return (
    <span
      style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}
      title="A captura continua recebendo linhas novas até você clicar em Parar"
    >
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-success)' }} />
      <strong style={{ color: 'var(--color-success)' }}>Ao vivo</strong> · {text} · {lines}
    </span>
  )
}
