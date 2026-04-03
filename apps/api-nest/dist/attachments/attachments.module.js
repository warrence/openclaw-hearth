"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const conversations_repository_1 = require("../conversations/conversations.repository");
const database_module_1 = require("../database/database.module");
const attachments_controller_1 = require("./attachments.controller");
const attachments_repository_1 = require("./attachments.repository");
const attachments_service_1 = require("./attachments.service");
const conversation_attachments_service_1 = require("./conversation-attachments.service");
let AttachmentsModule = class AttachmentsModule {
};
exports.AttachmentsModule = AttachmentsModule;
exports.AttachmentsModule = AttachmentsModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [attachments_controller_1.AttachmentsController],
        providers: [
            conversations_repository_1.ConversationsRepository,
            conversation_attachments_service_1.ConversationAttachmentsService,
            attachments_service_1.AttachmentsService,
            {
                provide: attachments_repository_1.AttachmentsRepository,
                inject: [config_1.ConfigService],
                useFactory: (configService) => new attachments_repository_1.AttachmentsRepository(configService.getOrThrow('attachments', {
                    infer: true,
                })),
            },
        ],
        exports: [conversation_attachments_service_1.ConversationAttachmentsService, attachments_service_1.AttachmentsService],
    })
], AttachmentsModule);
