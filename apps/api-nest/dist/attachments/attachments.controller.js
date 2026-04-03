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
exports.AttachmentsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const session_auth_guard_1 = require("../auth/session-auth.guard");
const attachments_constants_1 = require("./attachments.constants");
const conversation_attachments_service_1 = require("./conversation-attachments.service");
let AttachmentsController = class AttachmentsController {
    conversationAttachmentsService;
    constructor(conversationAttachmentsService) {
        this.conversationAttachmentsService = conversationAttachmentsService;
    }
    async uploadAttachment(actorUserId, conversationId, file) {
        const attachment = await this.conversationAttachmentsService.uploadAttachment(actorUserId, conversationId, file);
        const { path: _path, ...publicAttachment } = attachment;
        return {
            attachment: publicAttachment,
        };
    }
};
exports.AttachmentsController = AttachmentsController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.memoryStorage)(),
        limits: {
            fileSize: attachments_constants_1.MAX_ATTACHMENT_BYTES,
            files: 1,
        },
    })),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('conversationId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, Object]),
    __metadata("design:returntype", Promise)
], AttachmentsController.prototype, "uploadAttachment", null);
exports.AttachmentsController = AttachmentsController = __decorate([
    (0, common_1.Controller)('api/conversations/:conversationId/attachments'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __metadata("design:paramtypes", [conversation_attachments_service_1.ConversationAttachmentsService])
], AttachmentsController);
