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
var OutboundMessageService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboundMessageService = void 0;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const event_bus_service_1 = require("../events/event-bus.service");
const push_service_1 = require("../push/push.service");
const conversations_repository_1 = require("./conversations.repository");
const SESSION_KEY_RE = /^app:[^:]+:conv:[0-9a-f-]+$/i;
let OutboundMessageService = OutboundMessageService_1 = class OutboundMessageService {
    conversationsRepository;
    pushService;
    eventBus;
    logger = new common_1.Logger(OutboundMessageService_1.name);
    constructor(conversationsRepository, pushService, eventBus) {
        this.conversationsRepository = conversationsRepository;
        this.pushService = pushService;
        this.eventBus = eventBus;
    }
    async deliverOutboundMessage(payload) {
        const expectedToken = process.env['HEARTH_APP_CHANNEL_TOKEN'] ?? '';
        if (!expectedToken || payload.token !== expectedToken) {
            throw new common_1.UnauthorizedException('Invalid channel token');
        }
        const conversation = await this.resolveConversation(payload.to);
        if (!conversation) {
            this.logger.warn(`[outbound] Could not resolve conversation for to="${payload.to}"`);
            return;
        }
        await this.deliverToConversation(conversation, payload.text);
    }
    async deliverInternal(conversationId, userId, text) {
        const conversation = await this.conversationsRepository.findConversationById(conversationId);
        if (!conversation) {
            this.logger.warn(`[outbound] deliverInternal: conversation not found id=${conversationId}`);
            return;
        }
        await this.deliverToConversation(conversation, text);
    }
    async deliverToConversation(conversation, text) {
        await this.conversationsRepository.createAssistantMessage({
            conversationId: conversation.id,
            content: text,
            messageId: (0, node_crypto_1.randomUUID)(),
            agentId: conversation.agent_id,
        });
        let agentName = 'Assistant';
        try {
            const { readFileSync } = require('node:fs');
            const { join } = require('node:path');
            const { homedir } = require('node:os');
            const raw = readFileSync(join(homedir(), '.openclaw', 'hearth.json'), 'utf8');
            const cfg = JSON.parse(raw);
            if (cfg?.agentDisplayName)
                agentName = cfg.agentDisplayName;
        }
        catch { }
        await this.pushService.sendNotification(conversation.user_id, {
            title: agentName,
            body: text.slice(0, 100),
            conversationId: conversation.id,
            url: `/?profile=${conversation.user_id}&chat=${conversation.id}`,
        });
        this.eventBus.emit({
            type: 'message.created',
            userId: conversation.user_id,
            conversationId: conversation.id,
            data: {
                conversationId: conversation.id,
                message: { role: 'assistant', content: text },
                conversation: { id: conversation.id, title: conversation.title },
            },
        });
    }
    async resolveConversation(to) {
        if (SESSION_KEY_RE.test(to)) {
            return this.conversationsRepository.findConversationBySessionKey(to);
        }
        return this.conversationsRepository.findLatestActiveConversationByUserSlug(to);
    }
};
exports.OutboundMessageService = OutboundMessageService;
exports.OutboundMessageService = OutboundMessageService = OutboundMessageService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [conversations_repository_1.ConversationsRepository,
        push_service_1.PushService,
        event_bus_service_1.EventBusService])
], OutboundMessageService);
