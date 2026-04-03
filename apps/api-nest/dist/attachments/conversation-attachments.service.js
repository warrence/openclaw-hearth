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
exports.ConversationAttachmentsService = void 0;
const common_1 = require("@nestjs/common");
const conversations_repository_1 = require("../conversations/conversations.repository");
const attachments_service_1 = require("./attachments.service");
let ConversationAttachmentsService = class ConversationAttachmentsService {
    conversationsRepository;
    attachmentsService;
    constructor(conversationsRepository, attachmentsService) {
        this.conversationsRepository = conversationsRepository;
        this.attachmentsService = attachmentsService;
    }
    async uploadAttachment(actorUserId, conversationId, file) {
        await this.requireOwnedConversation(actorUserId, conversationId);
        return this.attachmentsService.storeTemporaryUpload(conversationId, file);
    }
    async finalizeUploads(actorUserId, conversationId, tokens) {
        await this.requireOwnedConversation(actorUserId, conversationId);
        return this.attachmentsService.finalizeUploads(actorUserId, conversationId, tokens);
    }
    async requireOwnedConversation(actorUserId, conversationId) {
        const conversation = await this.conversationsRepository.findConversationById(conversationId);
        if (!conversation) {
            throw new common_1.NotFoundException();
        }
        if (actorUserId !== Number.parseInt(String(conversation.user_id), 10)) {
            throw new common_1.ForbiddenException();
        }
        return conversation;
    }
};
exports.ConversationAttachmentsService = ConversationAttachmentsService;
exports.ConversationAttachmentsService = ConversationAttachmentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [conversations_repository_1.ConversationsRepository,
        attachments_service_1.AttachmentsService])
], ConversationAttachmentsService);
