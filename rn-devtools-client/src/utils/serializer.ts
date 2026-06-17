import { SerializedValue } from '../types'

export function safeSerialize(value: unknown, depth = 0, maxDepth = 10): SerializedValue {
  if (value === null) return { type: 'null', value: null }
  if (value === undefined) return { type: 'undefined', value: null }
  
  const type = typeof value

  if (type === 'string') return { type: 'string', value }
  if (type === 'number') return { type: 'number', value }
  if (type === 'boolean') return { type: 'boolean', value }
  if (type === 'bigint') return { type: 'bigint', value: value.toString() + 'n' }
  if (type === 'symbol') return { type: 'symbol', value: String(value) }
  
  if (type === 'function') {
    return { type: 'function', value: `[Function: ${(value as Function).name || 'anonymous'}]` }
  }

  if (value instanceof Error) {
    return { 
      type: 'error', 
      value: value.message,
      preview: value.stack 
    }
  }

  // Handle arrays and objects
  if (depth >= maxDepth) {
    return { 
      type: Array.isArray(value) ? 'array' : 'object', 
      value: Array.isArray(value) ? `[Array(${value.length})]` : '[Object]' 
    }
  }

  try {
    if (Array.isArray(value)) {
      const arr = value.slice(0, 1000).map(v => safeSerialize(v, depth + 1, maxDepth).value)
      return { 
        type: 'array', 
        value: arr,
        preview: value.length > 1000 ? `[Array(${value.length})] - Truncado por segurança` : undefined
      }
    }

    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj).slice(0, 500) // Limite aumentado para não cortar objetos grandes de API
    const result: Record<string, unknown> = {}
    
    for (const key of keys) {
      result[key] = safeSerialize(obj[key], depth + 1, maxDepth).value
    }
    
    return { type: 'object', value: result }
  } catch (e) {
    return { type: 'string', value: '[Unserializable]' }
  }
}
