import { describe, it, expect, beforeEach } from 'vitest'
import { useLogcatStore } from '../logcatStore'
import type { LogcatEntry } from '../../types/logcat'

function entry(id: number, timestamp: number): LogcatEntry {
  return { id, timestamp, time: '', pid: 1, tid: 1, level: 'I', tag: 'T', message: String(id) }
}

const ids = () => useLogcatStore.getState().getFilteredEntries().map((e) => e.id)

describe('logcatStore ordenação', () => {
  beforeEach(() => {
    useLogcatStore.setState({ entries: [], sortOrder: 'asc' })
  })

  it('ordena por data/hora linhas que chegam fora de ordem', () => {
    const { addEntries } = useLogcatStore.getState()
    addEntries([entry(1, 100), entry(2, 300)])
    addEntries([entry(3, 200), entry(4, 400)])
    expect(ids()).toEqual([1, 3, 2, 4])
  })

  it('desempata pelo id no mesmo milissegundo', () => {
    useLogcatStore.getState().addEntries([entry(2, 100), entry(1, 100)])
    expect(ids()).toEqual([1, 2])
  })

  it('ordem decrescente mostra os mais recentes primeiro', () => {
    const { addEntries, setSortOrder } = useLogcatStore.getState()
    addEntries([entry(1, 100), entry(2, 200), entry(3, 300)])
    setSortOrder('desc')
    expect(ids()).toEqual([3, 2, 1])
    // A visão não altera o array guardado.
    expect(useLogcatStore.getState().entries.map((e) => e.id)).toEqual([1, 2, 3])
  })
})
