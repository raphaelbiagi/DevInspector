/** Acima disso, uma única string sozinha já é grande demais para trafegar. */
const MAX_STRING_LENGTH = 100000;
export function safeSerialize(value, depth = 0, maxDepth = 10) {
    return serialize(value, depth, maxDepth, new WeakSet());
}
function truncateString(value) {
    if (value.length <= MAX_STRING_LENGTH)
        return value;
    const omitted = value.length - MAX_STRING_LENGTH;
    return `${value.slice(0, MAX_STRING_LENGTH)}... [DevInspector: ${omitted} caracteres omitidos]`;
}
function serialize(value, depth, maxDepth, seen) {
    if (value === null)
        return { type: 'null', value: null };
    if (value === undefined)
        return { type: 'undefined', value: null };
    const type = typeof value;
    if (type === 'string')
        return { type: 'string', value: truncateString(value) };
    if (type === 'number')
        return { type: 'number', value };
    if (type === 'boolean')
        return { type: 'boolean', value };
    if (type === 'bigint')
        return { type: 'bigint', value: value.toString() + 'n' };
    if (type === 'symbol')
        return { type: 'symbol', value: String(value) };
    if (type === 'function') {
        return { type: 'function', value: `[Function: ${value.name || 'anonymous'}]` };
    }
    if (value instanceof Error) {
        return {
            type: 'error',
            value: value.message,
            preview: value.stack
        };
    }
    // Tipos nativos que, sem tratamento, seriam serializados como `{}`
    if (value instanceof Date) {
        return { type: 'string', value: value.toISOString(), preview: 'Date' };
    }
    if (value instanceof RegExp) {
        return { type: 'string', value: String(value), preview: 'RegExp' };
    }
    if (value instanceof Map) {
        if (seen.has(value))
            return { type: 'string', value: '[Circular]' };
        seen.add(value);
        const entries = {};
        let count = 0;
        for (const [k, v] of value.entries()) {
            if (count >= 500) {
                entries['_devinspector_info'] = `... mais ${value.size - 500} entradas omitidas.`;
                break;
            }
            entries[String(k)] = serialize(v, depth + 1, maxDepth, seen).value;
            count++;
        }
        seen.delete(value);
        return { type: 'object', value: entries, preview: `Map(${value.size})` };
    }
    if (value instanceof Set) {
        if (seen.has(value))
            return { type: 'string', value: '[Circular]' };
        seen.add(value);
        const items = Array.from(value)
            .slice(0, 1000)
            .map((v) => serialize(v, depth + 1, maxDepth, seen).value);
        seen.delete(value);
        return { type: 'array', value: items, preview: `Set(${value.size})` };
    }
    // Referência circular: sem esta checagem, um objeto que aponta para si mesmo
    // só era contido pelo limite de profundidade, gerando payloads enormes.
    if (seen.has(value)) {
        return { type: 'string', value: '[Circular]' };
    }
    if (depth >= maxDepth) {
        return {
            type: Array.isArray(value) ? 'array' : 'object',
            value: Array.isArray(value) ? `[Array(${value.length})]` : '[Object]'
        };
    }
    try {
        seen.add(value);
        if (Array.isArray(value)) {
            const limit = 1000;
            const arr = value.slice(0, limit).map((v) => serialize(v, depth + 1, maxDepth, seen).value);
            if (value.length > limit) {
                arr.push({ _devinspector_info: `... mais ${value.length - limit} itens omitidos.` });
            }
            return {
                type: 'array',
                value: arr,
                preview: value.length > limit ? `[Array(${value.length})] - Truncado por segurança` : undefined
            };
        }
        const obj = value;
        const allKeys = Object.keys(obj);
        const limitKeys = 500;
        const keys = allKeys.slice(0, limitKeys); // Limite aumentado para não cortar objetos grandes de API
        const result = {};
        for (const key of keys) {
            result[key] = serialize(obj[key], depth + 1, maxDepth, seen).value;
        }
        if (allKeys.length > limitKeys) {
            result['_devinspector_info'] = `... mais ${allKeys.length - limitKeys} chaves omitidas.`;
        }
        return { type: 'object', value: result };
    }
    catch (e) {
        return { type: 'string', value: '[Unserializable]' };
    }
    finally {
        // Liberado ao sair do ramo: repetir o mesmo objeto em galhos irmãos é
        // legítimo, só a recursão para dentro de si mesmo é que é circular.
        seen.delete(value);
    }
}
//# sourceMappingURL=serializer.js.map