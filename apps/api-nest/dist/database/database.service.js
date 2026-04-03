"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pg_1 = require("pg");
let DatabaseService = class DatabaseService {
    configService;
    pool;
    constructor(configService) {
        this.configService = configService;
    }
    getConnectionOptions() {
        const config = this.configService.get('database', {
            infer: true,
        });
        if (!config) {
            throw new Error('Database configuration is missing.');
        }
        return {
            connectionString: config.url,
            host: config.url ? undefined : config.host,
            port: config.url ? undefined : config.port,
            user: config.url ? undefined : config.user,
            password: config.url ? undefined : config.password,
            database: config.url ? undefined : config.name,
            ssl: config.ssl ? { rejectUnauthorized: false } : false,
            max: 5,
            idleTimeoutMillis: 10000,
        };
    }
    getPool() {
        if (!this.pool) {
            this.pool = new pg_1.Pool(this.getConnectionOptions());
        }
        return this.pool;
    }
    async onModuleInit() {
        await this.query(`
      CREATE TABLE IF NOT EXISTS webauthn_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        counter BIGINT NOT NULL DEFAULT 0,
        device_type TEXT,
        backed_up BOOLEAN DEFAULT FALSE,
        transports TEXT[],
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        await this.query(`
      CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id
        ON webauthn_credentials(user_id)
    `);
    }
    async check() {
        const pool = this.getPool();
        const client = await pool.connect();
        try {
            await client.query('SELECT 1');
            return 'up';
        }
        finally {
            client.release();
        }
    }
    async query(text, params = []) {
        return this.getPool().query(text, [...params]);
    }
    async onModuleDestroy() {
        if (this.pool) {
            await this.pool.end();
        }
    }
};
exports.DatabaseService = DatabaseService;
exports.DatabaseService = DatabaseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], DatabaseService);
