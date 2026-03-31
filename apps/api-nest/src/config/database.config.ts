import { registerAs } from '@nestjs/config';

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

export const databaseConfig = registerAs(
  'database',
  (): DatabaseConfig => ({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    name: process.env.DATABASE_NAME ?? 'hearth',
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    schema: process.env.DATABASE_SCHEMA ?? 'public',
    ssl: process.env.DATABASE_SSL === 'true',
    url: process.env.DATABASE_URL || undefined,
    synchronize: process.env.DATABASE_SYNCHRONIZE === 'true',
    autoRunMigrations: process.env.DATABASE_AUTO_RUN_MIGRATIONS === 'true',
  }),
);
