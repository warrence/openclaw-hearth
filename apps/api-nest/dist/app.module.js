"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const app_controller_1 = require("./app.controller");
const app_config_1 = require("./config/app.config");
const auth_config_1 = require("./config/auth.config");
const attachments_config_1 = require("./config/attachments.config");
const database_config_1 = require("./config/database.config");
const conversations_module_1 = require("./conversations/conversations.module");
const env_validation_1 = require("./config/env.validation");
const database_module_1 = require("./database/database.module");
const health_module_1 = require("./health/health.module");
const attachments_module_1 = require("./attachments/attachments.module");
const openclaw_config_1 = require("./config/openclaw.config");
const auth_module_1 = require("./auth/auth.module");
const profiles_module_1 = require("./profiles/profiles.module");
const push_module_1 = require("./push/push.module");
const events_module_1 = require("./events/events.module");
const settings_module_1 = require("./settings/settings.module");
const tts_module_1 = require("./tts/tts.module");
const reminders_module_1 = require("./reminders/reminders.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                cache: true,
                expandVariables: true,
                load: [
                    app_config_1.appConfig,
                    auth_config_1.authConfig,
                    attachments_config_1.attachmentsConfig,
                    database_config_1.databaseConfig,
                    openclaw_config_1.openClawConfig,
                ],
                validationSchema: env_validation_1.envValidationSchema,
            }),
            database_module_1.DatabaseModule,
            auth_module_1.AuthModule,
            profiles_module_1.ProfilesModule,
            push_module_1.PushModule,
            settings_module_1.SettingsModule,
            conversations_module_1.ConversationsModule,
            reminders_module_1.RemindersModule,
            events_module_1.EventsModule,
            tts_module_1.TtsModule,
            attachments_module_1.AttachmentsModule,
            health_module_1.HealthModule,
        ],
        controllers: [app_controller_1.AppController],
    })
], AppModule);
