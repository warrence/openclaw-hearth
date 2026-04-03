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
var ReminderSchedulerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReminderSchedulerService = void 0;
const common_1 = require("@nestjs/common");
const reminders_service_1 = require("./reminders.service");
let ReminderSchedulerService = ReminderSchedulerService_1 = class ReminderSchedulerService {
    remindersService;
    logger = new common_1.Logger(ReminderSchedulerService_1.name);
    interval = null;
    constructor(remindersService) {
        this.remindersService = remindersService;
    }
    onModuleInit() {
        this.interval = setInterval(() => {
            this.remindersService.processDue().catch((err) => {
                this.logger.error('[reminder-scheduler] processDue error', err);
            });
            this.remindersService.processCriticalRepeats().catch((err) => {
                this.logger.error('[reminder-scheduler] processCriticalRepeats error', err);
            });
        }, 60_000);
    }
    onModuleDestroy() {
        if (this.interval !== null) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
};
exports.ReminderSchedulerService = ReminderSchedulerService;
exports.ReminderSchedulerService = ReminderSchedulerService = ReminderSchedulerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reminders_service_1.RemindersService])
], ReminderSchedulerService);
