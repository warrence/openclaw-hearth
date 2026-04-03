"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationStreamRegistryService = void 0;
const common_1 = require("@nestjs/common");
let ConversationStreamRegistryService = class ConversationStreamRegistryService {
    streams = new Map();
    register(token, params, emit, timeoutMs) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (this.streams.has(token)) {
                    this.streams.delete(token);
                    reject(new Error('Hearth channel stream timed out waiting for callback.'));
                }
            }, timeoutMs);
            this.streams.set(token, {
                params,
                startedAt: Date.now(),
                emit,
                resolve,
                reject,
                timer,
                partialText: '',
            });
        });
    }
    getEntry(token) {
        return this.streams.get(token);
    }
    cancel(token) {
        const entry = this.streams.get(token);
        if (!entry)
            return;
        clearTimeout(entry.timer);
        this.streams.delete(token);
    }
    complete(token) {
        const entry = this.streams.get(token);
        if (!entry)
            return;
        clearTimeout(entry.timer);
        this.streams.delete(token);
        entry.resolve();
    }
    fail(token, message) {
        const entry = this.streams.get(token);
        if (!entry)
            return;
        clearTimeout(entry.timer);
        this.streams.delete(token);
        entry.reject(new Error(message));
    }
    cancelByConversationId(conversationId) {
        for (const [token, entry] of this.streams.entries()) {
            if (entry.params.conversation.id === conversationId) {
                const sessionKey = entry.params.conversation.openclaw_session_key ?? '';
                const match = /app:([^:]+):conv:([a-f0-9-]+)/i.exec(sessionKey);
                const agentId = entry.params.conversation.agent_id ?? 'main';
                this.cancel(token);
                return {
                    agentId,
                    profileSlug: match?.[1] ?? '',
                    conversationUuid: match?.[2] ?? '',
                };
            }
        }
        return null;
    }
    get size() {
        return this.streams.size;
    }
};
exports.ConversationStreamRegistryService = ConversationStreamRegistryService;
exports.ConversationStreamRegistryService = ConversationStreamRegistryService = __decorate([
    (0, common_1.Injectable)()
], ConversationStreamRegistryService);
