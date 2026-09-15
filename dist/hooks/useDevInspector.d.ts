import type { ConnectionStatus } from '../types';
interface DevInspectorStatus {
    status: ConnectionStatus;
    bufferedEvents: number;
    isConnected: boolean;
    isRetrying: boolean;
}
/**
 * Hook para monitorar o status de conexão do DevInspector.
 *
 * Uso:
 * ```tsx
 * function DevIndicator() {
 *   const { status, bufferedEvents, isConnected } = useDevInspector()
 *
 *   return (
 *     <View style={{ position: 'absolute', top: 50, right: 10 }}>
 *       <View style={{
 *         width: 8, height: 8, borderRadius: 4,
 *         backgroundColor: isConnected ? 'green' : status === 'retrying' ? 'orange' : 'gray'
 *       }} />
 *       {bufferedEvents > 0 && <Text>{bufferedEvents}</Text>}
 *     </View>
 *   )
 * }
 * ```
 */
export declare function useDevInspector(): DevInspectorStatus;
export {};
