/**
 * DevInspector Discovery — Localiza automaticamente o Desktop na rede local
 *
 * React Native não expõe sockets UDP, então o cliente descobre o desktop por
 * HTTP probing: testa candidatos em paralelo no endpoint `/ping` e fica com o
 * primeiro que responder. (O desktop também mantém um servidor de discovery UDP
 * na porta 41234, usado por outros clientes — não por este.)
 *
 * Funciona em:
 * - iOS Simulator (compartilha rede do host)
 * - Android Emulator (fallback 10.0.2.2)
 * - Dispositivos físicos (mesma subnet Wi-Fi)
 */
export interface DiscoveryResult {
    host: string;
    port: number;
    machineName: string;
}
/**
 * Tenta descobrir o DevInspector Desktop na rede local.
 * Retorna null se não encontrar dentro do timeout.
 */
export declare function discoverDesktop(lifesaverIp?: string | null): Promise<DiscoveryResult | null>;
/**
 * Retorna lista de IPs candidatos para testar, baseado na plataforma.
 */
export declare function getFallbackHost(): string;
