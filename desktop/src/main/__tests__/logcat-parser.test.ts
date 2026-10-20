import { describe, it, expect } from 'vitest'
import {
  parseLogcatLine,
  isContinuation,
  parseAdbDevices,
  parsePackageList,
  parsePidList
} from '../logcat-parser'

const NOW = new Date(2026, 9, 19, 15, 0, 0)

describe('parseLogcatLine', () => {
  it('lê uma linha threadtime', () => {
    const entry = parseLogcatLine('10-19 14:03:22.123  1234  5678 I ReactNativeJS: Running "main"', 1, NOW)
    expect(entry).toEqual({
      id: 1,
      timestamp: new Date(2026, 9, 19, 14, 3, 22, 123).getTime(),
      time: '14:03:22.123',
      pid: 1234,
      tid: 5678,
      level: 'I',
      tag: 'ReactNativeJS',
      message: 'Running "main"'
    })
  })

  it('mantém ": " dentro da mensagem', () => {
    const entry = parseLogcatLine('10-19 14:03:22.123  1234  1234 E AndroidRuntime: Process: com.foo, PID: 1234', 1, NOW)
    expect(entry?.tag).toBe('AndroidRuntime')
    expect(entry?.message).toBe('Process: com.foo, PID: 1234')
  })

  it('aceita tag com espaço e mensagem vazia', () => {
    const entry = parseLogcatLine('10-19 14:03:22.123   99   100 W Some Tag:', 1, NOW)
    expect(entry?.tag).toBe('Some Tag')
    expect(entry?.message).toBe('')
  })

  it('ignora separadores de buffer', () => {
    expect(parseLogcatLine('--------- beginning of main', 1, NOW)).toBeNull()
    expect(parseLogcatLine('', 1, NOW)).toBeNull()
  })

  it('joga linhas de dezembro lidas em janeiro para o ano anterior', () => {
    const newYear = new Date(2027, 0, 1, 0, 0, 5)
    const entry = parseLogcatLine('12-31 23:59:59.900  1  1 D Tag: x', 1, newYear)
    expect(new Date(entry!.timestamp).getFullYear()).toBe(2026)
  })
})

describe('isContinuation', () => {
  it('une linhas com o mesmo cabeçalho', () => {
    const a = parseLogcatLine('10-19 14:03:22.123  1234  1234 E AndroidRuntime: FATAL EXCEPTION: main', 1, NOW)!
    const b = parseLogcatLine('10-19 14:03:22.123  1234  1234 E AndroidRuntime: java.lang.RuntimeException: boom', 2, NOW)!
    const c = parseLogcatLine('10-19 14:03:22.124  1234  1234 E AndroidRuntime: depois', 3, NOW)!
    expect(isContinuation(a, b)).toBe(true)
    expect(isContinuation(b, c)).toBe(false)
  })
})

describe('parseAdbDevices', () => {
  it('lê serial, estado e modelo', () => {
    const output = [
      '* daemon started successfully',
      'List of devices attached',
      'R58M123ABC             device usb:1-1 product:a51 model:SM_A515F device:a51 transport_id:1',
      'emulator-5554          offline',
      ''
    ].join('\r\n')
    expect(parseAdbDevices(output)).toEqual([
      { serial: 'R58M123ABC', state: 'device', model: 'SM A515F' },
      { serial: 'emulator-5554', state: 'offline', model: null }
    ])
  })

  it('devolve lista vazia sem dispositivos', () => {
    expect(parseAdbDevices('List of devices attached\n\n')).toEqual([])
  })
})

describe('parsePackageList / parsePidList', () => {
  it('lê pacotes ordenados', () => {
    expect(parsePackageList('package:com.b\r\npackage:com.a\n')).toEqual(['com.a', 'com.b'])
  })

  it('lê um ou mais PIDs e ignora vazio', () => {
    expect(parsePidList('1234 5678\n')).toEqual([1234, 5678])
    expect(parsePidList('')).toEqual([])
  })
})
