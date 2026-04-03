"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HearthActionsModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../database/database.module");
const conversations_repository_1 = require("../conversations/conversations.repository");
const reminders_module_1 = require("../reminders/reminders.module");
const hearth_action_processor_service_1 = require("./hearth-action-processor.service");
let HearthActionsModule = class HearthActionsModule {
};
exports.HearthActionsModule = HearthActionsModule;
exports.HearthActionsModule = HearthActionsModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, (0, common_1.forwardRef)(() => reminders_module_1.RemindersModule)],
        providers: [hearth_action_processor_service_1.HearthActionProcessorService, conversations_repository_1.ConversationsRepository],
        exports: [hearth_action_processor_service_1.HearthActionProcessorService],
    })
], HearthActionsModule);
