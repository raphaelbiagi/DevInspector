import { describe, it, expect } from 'vitest'
import { filterLogcatEntries, isFatalException, LOGCAT_LEVELS } from '../logcatFilter'
import type { LogcatEntry, LogcatLevel } from '../../types/logcat'

let nextId = 1
function entry(level: LogcatLevel, tag: string, message: string): LogcatEntry {
  return { id: nextId++, timestamp: 0, time: '00:00:00.000', pid: 1, tid: 1, level, tag, message }
}

const entries = [
  entry('V', 'Choreographer', 'Skipped 30 frames'),
  entry('D', 'ReactNativeJS', 'carregando lista'),
  entry('I', 'ReactNativeJS', 'Running "main"'),
  entry('W', 'ReactNativeJS', 'Reanimated warning'),
  entry('E', 'AndroidRuntime', 'FATAL EXCEPTION: main\njava.lang.RuntimeException: boom')
]

const ALL = new Set(LOGCAT_LEVELS)

describe('filterLogcatEntries', () => {
  it('sem filtro devolve o mesmo array', () => {
    expect(filterLogcatEntries(entries, ALL, '')).toBe(entries)
  })

  it('desligar um nível esconde só ele', () => {
    const semDebug = new Set(LOGCAT_LEVELS.filter((l) => l !== 'D'))
    expect(filterLogcatEntries(entries, semDebug, '').map((e) => e.level)).toEqual(['V', 'I', 'W', 'E'])
  })

  it('níveis não precisam ser contíguos', () => {
    const levels = new Set<LogcatLevel>(['V', 'E'])
    expect(filterLogcatEntries(entries, levels, '').map((e) => e.level)).toEqual(['V', 'E'])
  })

  it('tag: restringe à tag', () => {
    expect(filterLogcatEntries(entries, ALL, 'tag:reactnativejs')).toHaveLength(3)
  })

  it('combina tag, termo e exclusão', () => {
    const result = filterLogcatEntries(entries, ALL, 'tag:ReactNativeJS -reanimated main')
    expect(result.map((e) => e.message)).toEqual(['Running "main"'])
  })

  it('busca na mensagem multilinha', () => {
    expect(filterLogcatEntries(entries, ALL, 'RuntimeException')).toHaveLength(1)
  })
})

describe('isFatalException', () => {
  it('reconhece só o início do crash do AndroidRuntime', () => {
    expect(isFatalException(entries[4])).toBe(true)
    expect(isFatalException(entries[3])).toBe(false)
  })
})
