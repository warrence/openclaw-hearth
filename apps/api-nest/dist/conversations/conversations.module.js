"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const attachments_module_1 = require("../attachments/attachments.module");
const hearth_actions_module_1 = require("../actions/hearth-actions.module");
const database_module_1 = require("../database/database.module");
const push_module_1 = require("../push/push.module");
const reminders_module_1 = require("../reminders/reminders.module");
const settings_module_1 = require("../settings/settings.module");
const conversation_assistant_execution_service_1 = require("./conversation-assistant-execution.service");
const conversation_message_streaming_service_1 = require("./conversation-message-streaming.service");
const conversation_stream_registry_service_1 = require("./conversation-stream-registry.service");
const conversations_controller_1 = require("./conversations.controller");
const conversations_repository_1 = require("./conversations.repository");
const conversations_service_1 = require("./conversations.service");
const hearth_channel_callback_controller_1 = require("./hearth-channel-callback.controller");
const hearth_channel_outbound_controller_1 = require("./hearth-channel-outbound.controller");
const image_generation_service_1 = require("./image-generation.service");
const outbound_message_service_1 = require("./outbound-message.service");
let ConversationsModule = class ConversationsModule {
};
exports.ConversationsModule = ConversationsModule;
exports.ConversationsModule = ConversationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            database_module_1.DatabaseModule,
            attachments_module_1.AttachmentsModule,
            push_module_1.PushModule,
            settings_module_1.SettingsModule,
            (0, common_1.forwardRef)(() => reminders_module_1.RemindersModule),
            (0, common_1.forwardRef)(() => hearth_actions_module_1.HearthActionsModule),
        ],
        controllers: [
            conversations_controller_1.ConversationsController,
            hearth_channel_callback_controller_1.HearthChannelCallbackController,
            hearth_channel_outbound_controller_1.HearthChannelOutboundController,
        ],
        providers: [
            conversations_repository_1.ConversationsRepository,
            conversations_service_1.ConversationsService,
            conversation_assistant_execution_service_1.ConversationAssistantExecutionService,
            conversation_message_streaming_service_1.ConversationMessageStreamingService,
            conversation_stream_registry_service_1.ConversationStreamRegistryService,
            image_generation_service_1.ImageGenerationService,
            outbound_message_service_1.OutboundMessageService,
        ],
        exports: [conversations_repository_1.ConversationsRepository, outbound_message_service_1.OutboundMessageService],
    })
], ConversationsModule);
