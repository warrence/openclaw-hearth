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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const session_auth_guard_1 = require("../auth/session-auth.guard");
const conversations_service_1 = require("./conversations.service");
const create_conversation_dto_1 = require("./dto/create-conversation.dto");
const list_conversations_query_dto_1 = require("./dto/list-conversations-query.dto");
const send_conversation_message_dto_1 = require("./dto/send-conversation-message.dto");
const conversation_message_streaming_service_1 = require("./conversation-message-streaming.service");
const conversation_stream_registry_service_1 = require("./conversation-stream-registry.service");
const update_conversation_dto_1 = require("./dto/update-conversation.dto");
const config_1 = require("@nestjs/config");
const skip_auth_decorator_1 = require("../auth/skip-auth.decorator");
let ConversationsController = class ConversationsController {
    conversationsService;
    conversationMessageStreamingService;
    streamRegistry;
    configService;
    constructor(conversationsService, conversationMessageStreamingService, streamRegistry, configService) {
        this.conversationsService = conversationsService;
        this.conversationMessageStreamingService = conversationMessageStreamingService;
        this.streamRegistry = streamRegistry;
        this.configService = configService;
    }
    listUserConversations(actorUserId, userId, query) {
        return this.conversationsService.listUserConversations(actorUserId, userId, query);
    }
    getConversation(actorUserId, conversationId) {
        return this.conversationsService.getConversation(actorUserId, conversationId);
    }
    createConversation(actorUserId, userId, body) {
        return this.conversationsService.createConversation(actorUserId, userId, body);
    }
    listConversationMessages(actorUserId, conversationId) {
        return this.conversationsService.listConversationMessages(actorUserId, conversationId);
    }
    sendConversationMessage(actorUserId, conversationId, body, res) {
        if (body.stream === true) {
            return this.conversationsService
                .prepareConversationMessageStream(actorUserId, conversationId, body)
                .then(async (prepared) => {
                this.conversationMessageStreamingService.startSse(res);
                let resAlive = true;
                try {
                    await this.conversationsService.executePreparedConversationMessageStream(prepared, (event) => {
                        if (!resAlive)
                            return;
                        try {
                            this.conversationMessageStreamingService.writeEvent(res, event);
                        }
                        catch {
                            resAlive = false;
                        }
                    });
                }
                finally {
                    if (resAlive) {
                        this.conversationMessageStreamingService.endSse(res);
                    }
                }
            });
        }
        return this.conversationsService.sendConversationMessage(actorUserId, conversationId, body);
    }
    updateConversation(actorUserId, conversationId, body) {
        return this.conversationsService.updateConversation(actorUserId, conversationId, body);
    }
    async abortConversationReply(conversationId) {
        const sessionInfo = this.streamRegistry.cancelByConversationId(conversationId);
        if (!sessionInfo) {
            return { ok: true, cancelled: false, agentStopped: false };
        }
        let agentStopped = false;
        if (sessionInfo.profileSlug && sessionInfo.conversationUuid) {
            try {
                const config = this.configService.get('openclaw');
                const inboundUrl = config?.hearthChannelInboundUrl ?? 'http://127.0.0.1:18789/channel/hearth-app/inbound';
                const abortUrl = inboundUrl.replace(/\/inbound$/, '/abort');
                const token = config?.hearthChannelToken ?? '';
                const res = await fetch(abortUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token,
                        agentId: sessionInfo.agentId,
                        profileSlug: sessionInfo.profileSlug,
                        conversationUuid: sessionInfo.conversationUuid,
                    }),
                    signal: AbortSignal.timeout(5000),
                });
                agentStopped = res.ok;
            }
            catch (err) {
                console.error('[conversations] abort: failed to forward /stop to plugin', err);
            }
        }
        return { ok: true, cancelled: true, agentStopped };
    }
    archiveConversation(actorUserId, conversationId) {
        return this.conversationsService.archiveConversation(actorUserId, conversationId);
    }
    restoreConversation(actorUserId, conversationId) {
        return this.conversationsService.restoreConversation(actorUserId, conversationId);
    }
    deleteConversation(actorUserId, conversationId) {
        return this.conversationsService.deleteConversation(actorUserId, conversationId);
    }
};
exports.ConversationsController = ConversationsController;
__decorate([
    (0, common_1.Get)('users/:userId/conversations'),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, list_conversations_query_dto_1.ListConversationsQueryDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "listUserConversations", null);
__decorate([
    (0, common_1.Get)('conversations/:conversationId'),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('conversationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "getConversation", null);
__decorate([
    (0, common_1.Post)('users/:userId/conversations'),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, create_conversation_dto_1.CreateConversationDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "createConversation", null);
__decorate([
    (0, common_1.Get)('conversations/:conversationId/messages'),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('conversationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "listConversationMessages", null);
__decorate([
    (0, common_1.Post)('conversations/:conversationId/messages'),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('conversationId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, send_conversation_message_dto_1.SendConversationMessageDto, Object]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "sendConversationMessage", null);
__decorate([
    (0, common_1.Patch)('conversations/:conversationId'),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('conversationId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, update_conversation_dto_1.UpdateConversationDto]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "updateConversation", null);
__decorate([
    (0, common_1.Post)('conversations/:conversationId/messages/abort'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, skip_auth_decorator_1.SkipAuth)(),
    __param(0, (0, common_1.Param)('conversationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "abortConversationReply", null);
__decorate([
    (0, common_1.Post)('conversations/:conversationId/archive'),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('conversationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "archiveConversation", null);
__decorate([
    (0, common_1.Post)('conversations/:conversationId/restore'),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('conversationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "restoreConversation", null);
__decorate([
    (0, common_1.Delete)('conversations/:conversationId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('conversationId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], ConversationsController.prototype, "deleteConversation", null);
exports.ConversationsController = ConversationsController = __decorate([
    (0, common_1.Controller)('api'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __metadata("design:paramtypes", [conversations_service_1.ConversationsService,
        conversation_message_streaming_service_1.ConversationMessageStreamingService,
        conversation_stream_registry_service_1.ConversationStreamRegistryService,
        config_1.ConfigService])
], ConversationsController);
