"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemindersModule = void 0;
const common_1 = require("@nestjs/common");
const conversations_module_1 = require("../conversations/conversations.module");
const database_module_1 = require("../database/database.module");
const reminder_scheduler_service_1 = require("./reminder-scheduler.service");
const reminders_repository_1 = require("./reminders.repository");
const reminders_controller_1 = require("./reminders.controller");
const reminders_service_1 = require("./reminders.service");
let RemindersModule = class RemindersModule {
};
exports.RemindersModule = RemindersModule;
exports.RemindersModule = RemindersModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule, (0, common_1.forwardRef)(() => conversations_module_1.ConversationsModule)],
        controllers: [reminders_controller_1.RemindersController],
        providers: [reminders_repository_1.RemindersRepository, reminders_service_1.RemindersService, reminder_scheduler_service_1.ReminderSchedulerService],
        exports: [reminders_service_1.RemindersService, reminders_repository_1.RemindersRepository],
    })
], RemindersModule);
