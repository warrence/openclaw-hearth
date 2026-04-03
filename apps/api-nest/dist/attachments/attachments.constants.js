"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TEXT_EXCERPT_CHARS = exports.MAX_TEXT_CONTENT_CHARS = exports.MAX_ATTACHMENT_BYTES = exports.ATTACHMENT_ALLOWED_EXTENSIONS = void 0;
exports.ATTACHMENT_ALLOWED_EXTENSIONS = [
    'jpg',
    'jpeg',
    'png',
    'gif',
    'webp',
    'pdf',
    'txt',
    'md',
    'json',
    'csv',
];
exports.MAX_ATTACHMENT_BYTES = 12 * 1024 * 1024;
exports.MAX_TEXT_CONTENT_CHARS = 12_000;
exports.MAX_TEXT_EXCERPT_CHARS = 2_000;
