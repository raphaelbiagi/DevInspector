export class SqliteStorageAdapter {
    constructor(options) {
        this.connectionCache = {};
        this.options = options;
    }
    async getDatabases() {
        if (this.options.getDatabases) {
            const dbs = await this.options.getDatabases();
            return Array.isArray(dbs) ? Array.from(new Set(dbs.filter(Boolean))) : [];
        }
        if (this.options.fsLib) {
            try {
                const dir = this.options.customDbPath || this.options.fsLib.DocumentDirectoryPath;
                const files = await this.options.fsLib.readDir(dir);
                return files
                    .filter((f) => f.name.endsWith('.db') || f.name.endsWith('.sqlite'))
                    .map((f) => f.name);
            }
            catch (e) {
                console.warn('[DevInspector] Erro ao ler pasta do File System:', e);
                return [];
            }
        }
        console.warn('[DevInspector] Você precisa fornecer `getDatabases` ou `fsLib` no SqliteStorageAdapter para listar os bancos.');
        return [];
    }
    async getConnection(dbName) {
        if (this.connectionCache[dbName])
            return this.connectionCache[dbName];
        // react-native-sqlite-storage API
        const db = await this.options.sqliteLib.openDatabase({ name: dbName, location: 'default' });
        this.connectionCache[dbName] = db;
        return db;
    }
    async getTables(dbName) {
        const db = await this.getConnection(dbName);
        const [results] = await db.executeSql("SELECT name FROM sqlite_master WHERE type='table'");
        const tables = [];
        for (let i = 0; i < results.rows.length; i++) {
            const name = results.rows.item(i).name;
            if (!name.startsWith('sqlite_') && !name.startsWith('android_')) {
                tables.push(name);
            }
        }
        return tables;
    }
    async executeSql(dbName, query, args = []) {
        const db = await this.getConnection(dbName);
        const [results] = await db.executeSql(query, args);
        const rows = [];
        for (let i = 0; i < results.rows.length; i++) {
            rows.push(results.rows.item(i));
        }
        return rows;
    }
}
/**
 * Cria um adaptador Plug-and-Play para o react-native-sqlite-storage.
 */
export function createSqliteStorageAdapter(options) {
    return new SqliteStorageAdapter(options);
}
//# sourceMappingURL=sqliteStorageAdapter.js.map