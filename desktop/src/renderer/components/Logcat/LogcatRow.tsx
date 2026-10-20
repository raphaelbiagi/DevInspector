import React from 'react'
import type { LogcatEntry, LogcatLevel } from '../../types/logcat'
import { LOGCAT_LEVEL_INFO } from '../../utils/logcatFilter'

// O timestamp foi montado com os componentes locais do que o aparelho
// imprimiu, então os getters locais devolvem exatamente o dia do logcat.
function formatDay(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

const LEVEL_COLOR: Record<LogcatLevel, string> = {
  V: 'var(--color-text-muted)',
  D: 'var(--color-text-secondary)',
  I: 'var(--color-info)',
  W: 'var(--color-warning)',
  E: 'var(--color-error)',
  F: 'var(--color-error-bright)'
}

// Cor estável por tag, como no Android Studio: fica fácil seguir uma tag
// específica no meio do ruído sem precisar filtrar.
const tagColorCache = new Map<string, string>()
function tagColor(tag: string): string {
  let color = tagColorCache.get(tag)
  if (!color) {
    let hash = 0
    for (let i = 0; i < tag.length; i++) hash = (hash * 31 + tag.charCodeAt(i)) | 0
    color = `hsl(${Math.abs(hash) % 360}, 55%, 68%)`
    tagColorCache.set(tag, color)
  }
  return color
}

interface LogcatRowProps {
  entry: LogcatEntry
}

export const LogcatRow: React.FC<LogcatRowProps> = React.memo(({ entry }) => {
  const levelColor = LEVEL_COLOR[entry.level]
  const isProblem = entry.level === 'W' || entry.level === 'E' || entry.level === 'F'

  return (
    <div className={`logcat-row logcat-row-${entry.level}`}>
      <span className="logcat-time">{formatDay(entry.timestamp)} {entry.time}</span>
      <span className="logcat-pid" title="PID-TID (processo-thread)">{entry.pid}-{entry.tid}</span>
      <span className="logcat-level" style={{ color: levelColor }} title={LOGCAT_LEVEL_INFO[entry.level].label}>{entry.level}</span>
      <span className="logcat-tag" style={{ color: tagColor(entry.tag) }} title={entry.tag}>{entry.tag}</span>
      <span className="logcat-message" style={{ color: isProblem ? levelColor : 'inherit' }}>{entry.message}</span>
    </div>
  )
})
