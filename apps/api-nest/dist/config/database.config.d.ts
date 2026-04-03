export type DatabaseConfig = {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    schema: string;
    ssl: boolean;
    url?: string;
    synchronize: boolean;
    autoRunMigrations: boolean;
};
export declare const databaseConfig: (() => DatabaseConfig) & import("@nestjs/config").ConfigFactoryKeyHost<DatabaseConfig>;
