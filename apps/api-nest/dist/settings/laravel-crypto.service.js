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
exports.LaravelCryptoService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
let LaravelCryptoService = class LaravelCryptoService {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    encryptString(value) {
        const cipherName = this.resolveCipherName();
        const key = this.resolveKey();
        const iv = (0, node_crypto_1.randomBytes)(this.resolveIvLength(cipherName));
        const cipher = (0, node_crypto_1.createCipheriv)(cipherName, key, iv);
        const encrypted = Buffer.concat([
            cipher.update(value, 'utf8'),
            cipher.final(),
        ]);
        const ivBase64 = iv.toString('base64');
        const encryptedBase64 = encrypted.toString('base64');
        const mac = (0, node_crypto_1.createHmac)('sha256', key)
            .update(ivBase64 + encryptedBase64)
            .digest('hex');
        return Buffer.from(JSON.stringify({
            iv: ivBase64,
            value: encryptedBase64,
            mac,
            tag: '',
        })).toString('base64');
    }
    decryptString(payload) {
        const cipherName = this.resolveCipherName();
        const key = this.resolveKey();
        const decoded = this.decodePayload(payload);
        const iv = Buffer.from(decoded.iv, 'base64');
        const encrypted = Buffer.from(decoded.value, 'base64');
        const expectedMac = (0, node_crypto_1.createHmac)('sha256', key)
            .update(decoded.iv + decoded.value)
            .digest('hex');
        if (!(0, node_crypto_1.timingSafeEqual)(Buffer.from(expectedMac), Buffer.from(decoded.mac))) {
            throw new Error('Laravel payload MAC verification failed.');
        }
        const decipher = (0, node_crypto_1.createDecipheriv)(cipherName, key, iv);
        return Buffer.concat([
            decipher.update(encrypted),
            decipher.final(),
        ]).toString('utf8');
    }
    tryDecryptString(value) {
        if (!value) {
            return null;
        }
        try {
            return this.decryptString(value);
        }
        catch {
            return null;
        }
    }
    decodePayload(payload) {
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
        if (!decoded.iv || !decoded.value) {
            throw new Error('Laravel payload is missing encryption fields.');
        }
        return {
            iv: decoded.iv,
            value: decoded.value,
            mac: decoded.mac ?? '',
            tag: decoded.tag ?? '',
        };
    }
    resolveCipherName() {
        const cipher = String(this.configService.get('APP_CIPHER') ?? 'AES-256-CBC')
            .trim()
            .toLowerCase();
        if (cipher === 'aes-256-cbc') {
            return 'aes-256-cbc';
        }
        if (cipher === 'aes-128-cbc') {
            return 'aes-128-cbc';
        }
        throw new Error(`Unsupported Laravel cipher "${cipher}".`);
    }
    resolveKey() {
        const rawKey = this.configService.get('APP_KEY');
        if (!rawKey || rawKey.trim() === '') {
            throw new Error('APP_KEY is required for Laravel-compatible encryption.');
        }
        const trimmed = rawKey.trim();
        return trimmed.startsWith('base64:')
            ? Buffer.from(trimmed.slice(7), 'base64')
            : Buffer.from(trimmed, 'utf8');
    }
    resolveIvLength(cipherName) {
        if (cipherName.includes('-cbc') || cipherName.includes('-gcm')) {
            return 16;
        }
        throw new Error(`Unable to resolve IV length for cipher "${cipherName}".`);
    }
};
exports.LaravelCryptoService = LaravelCryptoService;
exports.LaravelCryptoService = LaravelCryptoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], LaravelCryptoService);
