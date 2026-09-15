import type { DatabaseDriver } from '../../types';
export interface ExpoSqliteAdapterOptions {
    /**
     * O pacote 'expo-sqlite'
     */
    sqliteLib: any;
    /**
     * Retorne os bancos de dados ativos no app.
     * Ex: () => [BANCO_PADRAO, getNomeBancoAtual()]
     */
    getDatabases?: () => Promise<string[]> | string[];
    /**
     * O pacote 'expo-file-system' (opcional, usado para escanear a pasta caso getDatabases não seja fornecido)
     */
    fsLib?: any;
}
export declare class ExpoSqliteAdapter implements DatabaseDriver {
    private options;
    private connectionCache;
    constructor(options: ExpoSqliteAdapterOptions);
    getDatabases(): Promise<string[]>;
    private getConnection;
    getTables(dbName: string): Promise<string[]>;
    executeSql(dbName: string, query: string, args?: any[], onChunk?: (chunk: any[]) => void): Promise<any>;
}
/**
 * Cria um adaptador Plug-and-Play para o expo-sqlite.
 */
export declare function createExpoSqliteAdapter(options: ExpoSqliteAdapterOptions): DatabaseDriver;
