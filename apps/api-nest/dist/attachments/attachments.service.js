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
exports.AttachmentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_crypto_1 = require("node:crypto");
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const node_path_1 = require("node:path");
const attachments_constants_1 = require("./attachments.constants");
const attachments_repository_1 = require("./attachments.repository");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const TEXT_EXTENSIONS = new Set([
    'txt',
    'md',
    'markdown',
    'rst',
    'json',
    'jsonl',
    'csv',
    'tsv',
    'yaml',
    'yml',
    'xml',
    'html',
    'htm',
    'css',
    'scss',
    'sass',
    'less',
    'env',
    'ini',
    'conf',
    'config',
    'properties',
    'js',
    'jsx',
    'ts',
    'tsx',
    'mjs',
    'cjs',
    'php',
    'phtml',
    'py',
    'pyw',
    'pyi',
    'rb',
    'erb',
    'java',
    'c',
    'cpp',
    'cc',
    'cxx',
    'h',
    'hpp',
    'cs',
    'swift',
    'kt',
    'go',
    'rs',
    'sh',
    'bash',
    'zsh',
    'fish',
    'ps1',
    'bat',
    'cmd',
    'vue',
    'svelte',
    'astro',
    'sql',
    'graphql',
    'gql',
    'tex',
    'bib',
]);
let AttachmentsService = class AttachmentsService {
    repository;
    config;
    constructor(configService, repository) {
        this.repository = repository;
        this.config = configService.getOrThrow('attachments', {
            infer: true,
        });
    }
    async storeTemporaryUpload(conversationId, file) {
        this.assertValidUpload(file);
        const uploadedFile = file;
        const extension = this.getExtension(uploadedFile.originalname);
        const tempPath = `attachments/tmp/${conversationId}/${(0, node_crypto_1.randomUUID)()}${extension ? `.${extension}` : ''}`;
        const uploadedAt = new Date().toISOString();
        await this.repository.write(tempPath, uploadedFile.buffer);
        const metadata = {
            conversation_id: conversationId,
            path: tempPath,
            name: uploadedFile.originalname,
            mime_type: uploadedFile.mimetype || 'application/octet-stream',
            size_bytes: uploadedFile.size,
            extension,
            category: this.detectCategory(uploadedFile.mimetype, extension),
            uploaded_at: uploadedAt,
            issued_at: uploadedAt,
        };
        return {
            ...this.formatAttachmentPayload(metadata),
            token: this.encryptToken(metadata),
        };
    }
    async finalizeUploads(userId, conversationId, tokens) {
        const attachments = [];
        for (const token of tokens) {
            const payload = this.decryptToken(token);
            if (payload.conversation_id !== conversationId) {
                throw new common_1.BadRequestException('Attachment token does not belong to this conversation.');
            }
            if (!(await this.repository.exists(payload.path))) {
                throw new common_1.BadRequestException('One of the selected attachments is no longer available.');
            }
            const safeBaseName = this.toSlug(payload.name.replace(/\.[^.]+$/, ''));
            const finalFileName = `${(0, node_crypto_1.randomUUID)()}-${safeBaseName || 'attachment'}${payload.extension ? `.${payload.extension}` : ''}`;
            const finalPath = `attachments/users/${userId}/${conversationId}/${finalFileName}`;
            await this.repository.move(payload.path, finalPath);
            const extraction = await this.extractAttachmentText(finalPath, payload.mime_type, payload.extension);
            attachments.push(this.formatAttachmentPayload({
                ...payload,
                id: (0, node_crypto_1.randomUUID)(),
                path: finalPath,
                url: `${this.config.publicBaseUrl}/${finalPath}`,
                internal_url: `${this.config.internalBaseUrl}/${finalPath}`,
                text_excerpt: extraction.text_excerpt,
                text_content: extraction.text_content,
                extraction_note: extraction.extraction_note,
            }));
        }
        return attachments;
    }
    assertValidUpload(file) {
        if (!file) {
            throw new common_1.BadRequestException('file is required');
        }
        if (file.size > attachments_constants_1.MAX_ATTACHMENT_BYTES) {
            throw new common_1.BadRequestException(`File too large. Maximum size is ${attachments_constants_1.MAX_ATTACHMENT_BYTES} bytes.`);
        }
        const extension = this.getExtension(file.originalname);
        if (!attachments_constants_1.ATTACHMENT_ALLOWED_EXTENSIONS.includes(extension)) {
            throw new common_1.BadRequestException('Invalid file type. Allowed types: jpg, jpeg, png, gif, webp, pdf, txt, md, json, csv.');
        }
    }
    getExtension(filename) {
        return (0, node_path_1.extname)(filename).replace(/^\./, '').toLowerCase();
    }
    formatAttachmentPayload(metadata) {
        return {
            id: metadata.id ?? null,
            name: metadata.name,
            mime_type: metadata.mime_type,
            size_bytes: metadata.size_bytes,
            extension: metadata.extension,
            category: metadata.category,
            uploaded_at: metadata.uploaded_at,
            url: metadata.url ?? null,
            internal_url: metadata.internal_url ?? null,
            text_excerpt: metadata.text_excerpt ?? null,
            text_content: metadata.text_content ?? null,
            extraction_note: metadata.extraction_note ?? null,
            path: metadata.path ?? null,
        };
    }
    detectCategory(mimeType, extension) {
        const normalizedMime = mimeType.toLowerCase();
        if (normalizedMime.startsWith('image/')) {
            return 'image';
        }
        if (normalizedMime === 'application/pdf' || extension === 'pdf') {
            return 'pdf';
        }
        if (normalizedMime.startsWith('text/') || TEXT_EXTENSIONS.has(extension)) {
            return 'text';
        }
        return 'file';
    }
    encryptToken(payload) {
        const iv = (0, node_crypto_1.randomBytes)(12);
        const key = (0, node_crypto_1.createHash)('sha256').update(this.config.tokenSecret).digest();
        const cipher = (0, node_crypto_1.createCipheriv)('aes-256-gcm', key, iv);
        const ciphertext = Buffer.concat([
            cipher.update(JSON.stringify(payload), 'utf8'),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return [
            'v1',
            iv.toString('base64url'),
            tag.toString('base64url'),
            ciphertext.toString('base64url'),
        ].join('.');
    }
    decryptToken(token) {
        const [version, ivEncoded, tagEncoded, ciphertextEncoded] = token.split('.');
        if (version !== 'v1' ||
            !ivEncoded ||
            !tagEncoded ||
            !ciphertextEncoded) {
            throw new common_1.BadRequestException('Invalid attachment token.');
        }
        try {
            const key = (0, node_crypto_1.createHash)('sha256').update(this.config.tokenSecret).digest();
            const decipher = (0, node_crypto_1.createDecipheriv)('aes-256-gcm', key, Buffer.from(ivEncoded, 'base64url'));
            decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
            const plaintext = Buffer.concat([
                decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
                decipher.final(),
            ]).toString('utf8');
            const payload = JSON.parse(plaintext);
            const issuedAtMs = Date.parse(payload.issued_at);
            if (!Number.isFinite(issuedAtMs) ||
                Date.now() - issuedAtMs > this.config.tokenTtlSeconds * 1000) {
                throw new common_1.BadRequestException('Attachment token has expired.');
            }
            return payload;
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw error;
            }
            throw new common_1.BadRequestException('Invalid attachment token.');
        }
    }
    async extractAttachmentText(relativePath, mimeType, extension) {
        const normalizedMime = mimeType.toLowerCase();
        if (normalizedMime === 'application/pdf' || extension === 'pdf') {
            const content = await this.extractPdfText(relativePath);
            if (content === null) {
                return {
                    text_excerpt: null,
                    text_content: null,
                    extraction_note: 'PDF text extraction failed (possibly scanned/image-only or restricted).',
                };
            }
            return {
                text_excerpt: content.slice(0, attachments_constants_1.MAX_TEXT_EXCERPT_CHARS) || null,
                text_content: content.slice(0, attachments_constants_1.MAX_TEXT_CONTENT_CHARS) || null,
                extraction_note: null,
            };
        }
        if (!normalizedMime.startsWith('text/') && !TEXT_EXTENSIONS.has(extension)) {
            return {
                text_excerpt: null,
                text_content: null,
                extraction_note: null,
            };
        }
        try {
            const content = await this.repository.read(relativePath);
            if (!this.isValidText(content)) {
                return {
                    text_excerpt: null,
                    text_content: null,
                    extraction_note: null,
                };
            }
            const normalized = this.normalizeExtractedText(content.toString('utf8'));
            if (!normalized) {
                return {
                    text_excerpt: null,
                    text_content: null,
                    extraction_note: null,
                };
            }
            return {
                text_excerpt: normalized.slice(0, attachments_constants_1.MAX_TEXT_EXCERPT_CHARS),
                text_content: normalized.slice(0, attachments_constants_1.MAX_TEXT_CONTENT_CHARS),
                extraction_note: null,
            };
        }
        catch {
            return {
                text_excerpt: null,
                text_content: null,
                extraction_note: null,
            };
        }
    }
    async extractPdfText(relativePath) {
        try {
            const { stdout } = await execFileAsync('pdftotext', [
                '-layout',
                '-enc',
                'UTF-8',
                this.repository.resolve(relativePath),
                '-',
            ]);
            const normalized = this.normalizeExtractedText(stdout);
            return normalized || null;
        }
        catch {
            return null;
        }
    }
    normalizeExtractedText(content) {
        return content
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }
    isValidText(content) {
        if (content.length === 0) {
            return false;
        }
        if (content.includes(0)) {
            return false;
        }
        try {
            const decoded = new TextDecoder('utf-8', { fatal: true }).decode(content.subarray(0, 1024));
            return decoded.length >= 0;
        }
        catch {
            return false;
        }
    }
    toSlug(value) {
        const normalized = value
            .normalize('NFKD')
            .replace(/[^\w\s-]/g, '')
            .trim()
            .toLowerCase();
        return normalized.replace(/[-\s]+/g, '-');
    }
};
exports.AttachmentsService = AttachmentsService;
exports.AttachmentsService = AttachmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        attachments_repository_1.AttachmentsRepository])
], AttachmentsService);
