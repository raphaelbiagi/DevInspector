/**
 * Declarações do ambiente React Native usadas pelo SDK.
 *
 * Deliberadamente não usamos @types/node: este pacote roda em Hermes/JSC, não
 * em Node, e trazer os globais do Node (Buffer, process, __dirname) faria o
 * compilador aceitar APIs que não existem em tempo de execução.
 */

/** Metro expõe `require` síncrono; usado para carregar pacotes opcionais como expo-constants. */
declare function require(moduleName: string): any

declare const global: typeof globalThis & Record<string, any>

/**
 * Definido pelo Metro: `true` em desenvolvimento, `false` em builds de produção.
 * É o que permite o SDK se desligar sozinho quando o app vai para a loja.
 */
declare const __DEV__: boolean
