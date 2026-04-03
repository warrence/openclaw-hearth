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
var HearthActionProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.HearthActionProcessorService = void 0;
const common_1 = require("@nestjs/common");
const conversations_repository_1 = require("../conversations/conversations.repository");
const reminders_service_1 = require("../reminders/reminders.service");
const reminders_repository_1 = require("../reminders/reminders.repository");
let HearthActionProcessorService = HearthActionProcessorService_1 = class HearthActionProcessorService {
    remindersService;
    remindersRepository;
    conversationsRepository;
    logger = new common_1.Logger(HearthActionProcessorService_1.name);
    constructor(remindersService, remindersRepository, conversationsRepository) {
        this.remindersService = remindersService;
        this.remindersRepository = remindersRepository;
        this.conversationsRepository = conversationsRepository;
    }
    parseActions(text) {
        const actions = [];
        const cleanedText = text
            .replace(/```hearth-action\s*([\s\S]*?)\s*```/g, (_match, block) => {
            try {
                const parsed = JSON.parse(block.trim());
                const items = Array.isArray(parsed)
                    ? parsed
                    : [parsed];
                actions.push(...items);
            }
            catch (err) {
                this.logger.warn(`[hearth-actions] Failed to parse action block: ${err}`);
            }
            return '';
        })
            .replace(/\n*hearth-action\s*(\{[\s\S]*?\})\s*/gi, (_match, jsonStr) => {
            try {
                if (jsonStr) {
                    const parsed = JSON.parse(jsonStr.trim());
                    actions.push(parsed);
                }
            }
            catch { }
            return '';
        })
            .replace(/\n*Note:\s*I did not schedule[^.]*\.\s*/gi, '')
            .replace(/\n*Note:\s*[^\n]*hearth.action[^\n]*/gi, '')
            .replace(/\n*Note:\s*[^\n]*(not trigger|won't trigger|will not trigger)[^\n]*/gi, '')
            .trim();
        return { cleanedText, actions };
    }
    async processActions(actions, context) {
        for (const action of actions) {
            try {
                await this.dispatchAction(action, context);
            }
            catch (err) {
                this.logger.warn(`[hearth-actions] Failed to process action type=${action.type}: ${err}`);
            }
        }
    }
    async dispatchAction(action, context) {
        switch (action.type) {
            case 'reminder':
                await this.handleReminder(action, context);
                break;
            case 'list-reminders':
                await this.handleListReminders(action, context);
                break;
            case 'cancel-reminder':
                await this.handleCancelReminder(action, context);
                break;
            default:
                this.logger.warn(`[hearth-actions] Unimplemented action type: ${action.type}`);
        }
    }
    async handleReminder(action, context) {
        let targetUserId = context.userId;
        let targetConversationId = context.conversationId;
        if (action.target && action.target.trim()) {
            const targetSlug = action.target.trim().toLowerCase();
            try {
                const targetUser = await this.conversationsRepository.findUserBySlug(targetSlug);
                if (targetUser) {
                    const newConversation = await this.conversationsRepository.createConversation({
                        userId: targetUser.id,
                        title: `Reminder`,
                    });
                    targetUserId = targetUser.id;
                    targetConversationId = newConversation.id;
                    this.logger.log(`[hearth-actions] Reminder targeting ${targetSlug}: created conv=${targetConversationId} for user=${targetUserId}`);
                }
                else {
                    this.logger.warn(`[hearth-actions] Target member "${targetSlug}" not found — falling back to sender`);
                }
            }
            catch (err) {
                this.logger.warn(`[hearth-actions] Failed to resolve target "${targetSlug}": ${err}`);
            }
        }
        await this.remindersService.scheduleReminder({
            userId: targetUserId,
            conversationId: targetConversationId,
            messageText: action.text,
            fireAt: new Date(action.fire_at),
            sourceMessageId: context.messageId,
            critical: action.critical ?? this.detectCriticalFromText(action.text),
        });
    }
    detectCriticalFromText(text) {
        const critical = /\b(critical|important|urgent|must not miss|don'?t miss|keep remind|nag|persistent)\b/i;
        return critical.test(text);
    }
    async handleListReminders(action, context) {
        const conversation = await this.conversationsRepository.findConversationById(context.conversationId);
        const isOwner = conversation?.user?.role === 'owner';
        const reminders = await this.remindersRepository.listReminders({
            userId: (isOwner && action.all) ? undefined : context.userId,
            status: 'pending',
        });
        this.logger.log(`[hearth-actions] Listed ${reminders.length} reminders for user=${context.userId}`);
        this.__lastListResult = reminders.map((r) => ({
            id: r.id,
            text: r.message_text,
            fire_at: r.fire_at,
            critical: r.critical,
            user_id: r.user_id,
        }));
    }
    async handleCancelReminder(action, context) {
        const conversation = await this.conversationsRepository.findConversationById(context.conversationId);
        const isOwner = conversation?.user?.role === 'owner';
        const cancelled = await this.remindersRepository.cancelReminder(action.id, isOwner ? undefined : context.userId);
        this.logger.log(`[hearth-actions] Cancel reminder id=${action.id}: ${cancelled ? 'success' : 'not found or not authorized'}`);
    }
};
exports.HearthActionProcessorService = HearthActionProcessorService;
exports.HearthActionProcessorService = HearthActionProcessorService = HearthActionProcessorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [reminders_service_1.RemindersService,
        reminders_repository_1.RemindersRepository,
        conversations_repository_1.ConversationsRepository])
], HearthActionProcessorService);
