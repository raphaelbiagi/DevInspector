import type { DatabaseDriver } from '../../types';
export interface SqliteStorageAdapterOptions {
    /**
     * O pacote 'react-native-sqlite-storage'
     */
    sqliteLib: any;
    /**
     * O pacote 'react-native-fs' ou similar que possui readDir
     */
    fsLib?: any;
    /**
     * Pasta para procurar. Default: DocumentDirectoryPath
     */
    customDbPath?: string;
    /**
     * Retorne os bancos de dados ativos no app manualmente.
     */
    getDatabases?: () => Promise<string[]> | string[];
}
export declare class SqliteStorageAdapter implements DatabaseDriver {
    private options;
    private connectionCache;
    constructor(options: SqliteStorageAdapterOptions);
    getDatabases(): Promise<string[]>;
    private getConnection;
    getTables(dbName: string): Promise<string[]>;
    executeSql(dbName: string, query: string, args?: any[]): Promise<any>;
}
/**
 * Cria um adaptador Plug-and-Play para o react-native-sqlite-storage.
 */
export declare function createSqliteStorageAdapter(options: SqliteStorageAdapterOptions): DatabaseDriver;
