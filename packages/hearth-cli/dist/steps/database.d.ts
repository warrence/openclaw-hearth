import { Client } from 'pg';
export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    url: string;
    client: Client;
}
export declare function setupDatabase(): Promise<DatabaseConfig>;
