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
var RemindersService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemindersService = void 0;
const common_1 = require("@nestjs/common");
const outbound_message_service_1 = require("../conversations/outbound-message.service");
const reminders_repository_1 = require("./reminders.repository");
let RemindersService = RemindersService_1 = class RemindersService {
    repository;
    outboundMessageService;
    logger = new common_1.Logger(RemindersService_1.name);
    constructor(repository, outboundMessageService) {
        this.repository = repository;
        this.outboundMessageService = outboundMessageService;
    }
    async scheduleReminder(params) {
        await this.repository.createReminder(params);
        this.logger.log(`[reminders] Scheduled ${params.critical ? 'CRITICAL ' : ''}reminder for user=${params.userId} at ${params.fireAt.toISOString()}`);
    }
    async processDue() {
        const due = await this.repository.findDueReminders();
        if (due.length === 0)
            return;
        this.logger.log(`[reminders] Processing ${due.length} due reminder(s)`);
        for (const reminder of due) {
            try {
                await this.outboundMessageService.deliverInternal(reminder.conversation_id, reminder.user_id, reminder.message_text);
                await this.repository.markFired(reminder.id);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                this.logger.warn(`[reminders] Failed to deliver reminder id=${reminder.id}: ${message}`);
                await this.repository.markFailed(reminder.id, message);
            }
        }
    }
    async processCriticalRepeats() {
        const config = this.getCriticalConfig();
        if (!config.enabled)
            return;
        const unacked = await this.repository.findUnacknowledgedCritical();
        if (unacked.length === 0)
            return;
        for (const reminder of unacked) {
            if (reminder.repeat_count >= config.maxRepeats) {
                this.logger.log(`[reminders] Critical reminder id=${reminder.id} reached max repeats (${config.maxRepeats}), stopping`);
                await this.repository.markAcknowledged(reminder.id);
                continue;
            }
            const firedAt = reminder.fire_at;
            const hasReplied = await this.repository.hasUserRepliedSince(reminder.conversation_id, firedAt);
            if (hasReplied) {
                this.logger.log(`[reminders] Critical reminder id=${reminder.id} acknowledged by user reply`);
                await this.repository.markAcknowledged(reminder.id);
                continue;
            }
            const lastRepeatAt = reminder.fired_at ?? reminder.fire_at;
            const lastFiredMs = lastRepeatAt instanceof Date ? lastRepeatAt.getTime() : new Date(lastRepeatAt).getTime();
            const intervalMs = config.intervalMinutes * 60 * 1000;
            if (Date.now() - lastFiredMs < intervalMs)
                continue;
            try {
                this.logger.log(`[reminders] Repeating critical reminder id=${reminder.id} (repeat #${reminder.repeat_count + 1})`);
                await this.outboundMessageService.deliverInternal(reminder.conversation_id, reminder.user_id, `⚠️ ${reminder.message_text}`);
                await this.repository.incrementRepeatCount(reminder.id);
            }
            catch (err) {
                this.logger.warn(`[reminders] Failed to repeat critical id=${reminder.id}: ${err}`);
            }
        }
    }
    getCriticalConfig() {
        try {
            const { readFileSync } = require('node:fs');
            const { join } = require('node:path');
            const { homedir } = require('node:os');
            const raw = readFileSync(join(homedir(), '.openclaw', 'hearth.json'), 'utf8');
            const cfg = JSON.parse(raw);
            return {
                enabled: cfg?.reminders?.critical?.enabled ?? true,
                intervalMinutes: cfg?.reminders?.critical?.intervalMinutes ?? 1,
                maxRepeats: cfg?.reminders?.critical?.maxRepeats ?? 30,
            };
        }
        catch {
            return { enabled: true, intervalMinutes: 1, maxRepeats: 30 };
        }
    }
    parseReminderFromText(text, _conversationSessionKey) {
        const now = new Date();
        const inMinutesMatch = text.match(/remind(?:ing)? (?:you )?(?:me )?in (\d+)\s*minutes?/i);
        if (inMinutesMatch) {
            const minutes = parseInt(inMinutesMatch[1], 10);
            const fireAt = new Date(now.getTime() + minutes * 60 * 1000);
            return { fireAt, reminderText: text.trim().slice(0, 500) };
        }
        const inHoursMatch = text.match(/remind(?:ing)? (?:you )?(?:me )?in (\d+)\s*hours?/i);
        if (inHoursMatch) {
            const hours = parseInt(inHoursMatch[1], 10);
            const fireAt = new Date(now.getTime() + hours * 60 * 60 * 1000);
            return { fireAt, reminderText: text.trim().slice(0, 500) };
        }
        const tomorrowAtMatch = text.match(/remind(?:ing)? (?:you )?(?:me )?tomorrow at (\d{1,2}):(\d{2})(?:\s*(am|pm))?/i);
        if (tomorrowAtMatch) {
            const fireAt = new Date(now);
            fireAt.setDate(fireAt.getDate() + 1);
            fireAt.setHours(this.parseHour(parseInt(tomorrowAtMatch[1], 10), tomorrowAtMatch[3] ?? null), parseInt(tomorrowAtMatch[2], 10), 0, 0);
            return { fireAt, reminderText: text.trim().slice(0, 500) };
        }
        const atTimeMatch = text.match(/remind(?:ing)? (?:you )?(?:me )?at (\d{1,2}):(\d{2})(?:\s*(am|pm))?/i);
        if (atTimeMatch) {
            const fireAt = new Date(now);
            fireAt.setHours(this.parseHour(parseInt(atTimeMatch[1], 10), atTimeMatch[3] ?? null), parseInt(atTimeMatch[2], 10), 0, 0);
            if (fireAt <= now) {
                fireAt.setDate(fireAt.getDate() + 1);
            }
            return { fireAt, reminderText: text.trim().slice(0, 500) };
        }
        return null;
    }
    parseHour(hour, amPm) {
        if (!amPm)
            return hour;
        const lower = amPm.toLowerCase();
        if (lower === 'pm' && hour < 12)
            return hour + 12;
        if (lower === 'am' && hour === 12)
            return 0;
        return hour;
    }
};
exports.RemindersService = RemindersService;
exports.RemindersService = RemindersService = RemindersService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)((0, common_1.forwardRef)(() => outbound_message_service_1.OutboundMessageService))),
    __metadata("design:paramtypes", [reminders_repository_1.RemindersRepository,
        outbound_message_service_1.OutboundMessageService])
], RemindersService);
