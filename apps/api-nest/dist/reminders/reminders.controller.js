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
exports.RemindersController = void 0;
const common_1 = require("@nestjs/common");
const session_auth_guard_1 = require("../auth/session-auth.guard");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const reminders_repository_1 = require("./reminders.repository");
let RemindersController = class RemindersController {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async listReminders(userId, status, user) {
        const isOwner = user.role === 'owner';
        const targetUserId = isOwner ? (userId === 0 ? undefined : userId) : user.id;
        const reminders = await this.repository.listReminders({
            userId: targetUserId,
            status: status || 'pending',
        });
        return reminders.map((r) => ({
            id: r.id,
            user_id: r.user_id,
            message_text: r.message_text,
            fire_at: r.fire_at,
            status: r.status,
            critical: r.critical,
            repeat_count: r.repeat_count,
            created_at: r.created_at,
        }));
    }
    async cancelReminder(id, user) {
        const isOwner = user.role === 'owner';
        const cancelled = await this.repository.cancelReminder(id, isOwner ? undefined : user.id);
        return { ok: cancelled, id };
    }
};
exports.RemindersController = RemindersController;
__decorate([
    (0, common_1.Get)('users/:userId/reminders'),
    __param(0, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('status')),
    __param(2, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], RemindersController.prototype, "listReminders", null);
__decorate([
    (0, common_1.Post)('reminders/:id/cancel'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], RemindersController.prototype, "cancelReminder", null);
exports.RemindersController = RemindersController = __decorate([
    (0, common_1.Controller)('api'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __metadata("design:paramtypes", [reminders_repository_1.RemindersRepository])
], RemindersController);
