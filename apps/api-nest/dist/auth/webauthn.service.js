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
exports.WebAuthnService = void 0;
const common_1 = require("@nestjs/common");
const server_1 = require("@simplewebauthn/server");
const database_service_1 = require("../database/database.service");
const challengeStore = new Map();
let WebAuthnService = class WebAuthnService {
    db;
    rpID = process.env.WEBAUTHN_RP_ID ?? 'localhost';
    origin = process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:9100';
    rpName = 'Hearth';
    constructor(db) {
        this.db = db;
    }
    async ensureTable() {
        await this.db.query(`
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
        await this.db.query(`
      CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id
        ON webauthn_credentials(user_id)
    `);
    }
    async getRegistrationOptions(userId, userName) {
        const existing = await this.db.query('SELECT credential_id FROM webauthn_credentials WHERE user_id = $1', [userId]);
        const excludeCredentials = existing.rows.map((r) => ({
            id: r.credential_id,
            type: 'public-key',
        }));
        const options = await (0, server_1.generateRegistrationOptions)({
            rpName: this.rpName,
            rpID: this.rpID,
            userID: new TextEncoder().encode(String(userId)),
            userName,
            attestationType: 'none',
            excludeCredentials,
            authenticatorSelection: {
                residentKey: 'preferred',
                userVerification: 'preferred',
            },
        });
        challengeStore.set(userId, {
            challenge: options.challenge,
            expires: Date.now() + 300_000,
        });
        return options;
    }
    async verifyRegistration(userId, body) {
        const stored = challengeStore.get(userId);
        if (!stored || Date.now() > stored.expires) {
            throw new common_1.BadRequestException('Challenge expired. Please try again.');
        }
        let verification;
        try {
            verification = await (0, server_1.verifyRegistrationResponse)({
                response: body,
                expectedChallenge: stored.challenge,
                expectedOrigin: this.origin,
                expectedRPID: this.rpID,
            });
        }
        catch {
            throw new common_1.BadRequestException('Registration verification failed.');
        }
        if (!verification.verified || !verification.registrationInfo) {
            throw new common_1.BadRequestException('Registration verification failed.');
        }
        const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
        await this.db.query(`INSERT INTO webauthn_credentials
         (user_id, credential_id, public_key, counter, device_type, backed_up, transports)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (credential_id) DO UPDATE
         SET counter = $4, updated_at = CURRENT_TIMESTAMP`, [
            userId,
            credential.id,
            Buffer.from(credential.publicKey).toString('base64'),
            credential.counter,
            credentialDeviceType ?? null,
            credentialBackedUp ?? false,
            credential.transports ?? null,
        ]);
        challengeStore.delete(userId);
        return { verified: true };
    }
    async getAuthenticationOptions(userId) {
        const credentials = await this.db.query('SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = $1', [userId]);
        if (credentials.rows.length === 0) {
            throw new common_1.BadRequestException('No credentials registered for this profile.');
        }
        const allowCredentials = credentials.rows.map((r) => ({
            id: r.credential_id,
            type: 'public-key',
            ...(r.transports ? { transports: r.transports } : {}),
        }));
        const options = await (0, server_1.generateAuthenticationOptions)({
            rpID: this.rpID,
            allowCredentials,
            userVerification: 'preferred',
        });
        challengeStore.set(userId, {
            challenge: options.challenge,
            expires: Date.now() + 300_000,
        });
        return options;
    }
    async verifyAuthentication(userId, body) {
        const stored = challengeStore.get(userId);
        if (!stored || Date.now() > stored.expires) {
            throw new common_1.UnauthorizedException('Challenge expired. Please try again.');
        }
        const bodyAny = body;
        const credResult = await this.db.query(`SELECT credential_id, public_key, counter, transports
       FROM webauthn_credentials
       WHERE credential_id = $1 AND user_id = $2`, [bodyAny['id'], userId]);
        if (!credResult.rows[0]) {
            throw new common_1.UnauthorizedException('Credential not found.');
        }
        const cred = credResult.rows[0];
        let verification;
        try {
            verification = await (0, server_1.verifyAuthenticationResponse)({
                response: body,
                expectedChallenge: stored.challenge,
                expectedOrigin: this.origin,
                expectedRPID: this.rpID,
                credential: {
                    id: cred.credential_id,
                    publicKey: Buffer.from(cred.public_key, 'base64'),
                    counter: Number(cred.counter),
                    ...(cred.transports
                        ? { transports: cred.transports }
                        : {}),
                },
            });
        }
        catch {
            throw new common_1.UnauthorizedException('Authentication verification failed.');
        }
        if (!verification.verified) {
            throw new common_1.UnauthorizedException('Authentication failed.');
        }
        await this.db.query(`UPDATE webauthn_credentials
       SET counter = $1, updated_at = CURRENT_TIMESTAMP
       WHERE credential_id = $2`, [verification.authenticationInfo.newCounter, cred.credential_id]);
        challengeStore.delete(userId);
        return { verified: true };
    }
    async listCredentials(userId) {
        const result = await this.db.query(`SELECT id, credential_id, device_type, backed_up, created_at
       FROM webauthn_credentials
       WHERE user_id = $1
       ORDER BY created_at DESC`, [userId]);
        return result.rows;
    }
    async deleteCredential(userId, credentialId) {
        await this.db.query(`DELETE FROM webauthn_credentials
       WHERE user_id = $1 AND credential_id = $2`, [userId, credentialId]);
    }
};
exports.WebAuthnService = WebAuthnService;
exports.WebAuthnService = WebAuthnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [database_service_1.DatabaseService])
], WebAuthnService);
