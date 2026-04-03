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
exports.PushController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("../auth/current-user.decorator");
const session_auth_guard_1 = require("../auth/session-auth.guard");
const delete_push_subscription_dto_1 = require("./dto/delete-push-subscription.dto");
const save_push_subscription_dto_1 = require("./dto/save-push-subscription.dto");
const update_push_presence_dto_1 = require("./dto/update-push-presence.dto");
const push_service_1 = require("./push.service");
let PushController = class PushController {
    pushService;
    constructor(pushService) {
        this.pushService = pushService;
    }
    getPublicKey() {
        return this.pushService.getPublicKey();
    }
    saveSubscription(actorUserId, userId, body, userAgent) {
        return this.pushService.saveSubscription(actorUserId, userId, body, userAgent);
    }
    updatePresence(actorUserId, userId, body) {
        return this.pushService.updatePresence(actorUserId, userId, body);
    }
    async deleteSubscription(actorUserId, userId, body) {
        await this.pushService.deleteSubscription(actorUserId, userId, body);
    }
};
exports.PushController = PushController;
__decorate([
    (0, common_1.Get)('push/public-key'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], PushController.prototype, "getPublicKey", null);
__decorate([
    (0, common_1.Post)('users/:userId/push-subscriptions'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __param(3, (0, common_1.Headers)('user-agent')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, save_push_subscription_dto_1.SavePushSubscriptionDto, String]),
    __metadata("design:returntype", void 0)
], PushController.prototype, "saveSubscription", null);
__decorate([
    (0, common_1.Post)('users/:userId/push-subscriptions/presence'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, update_push_presence_dto_1.UpdatePushPresenceDto]),
    __metadata("design:returntype", void 0)
], PushController.prototype, "updatePresence", null);
__decorate([
    (0, common_1.Delete)('users/:userId/push-subscriptions'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    __param(0, (0, current_user_decorator_1.CurrentUserId)()),
    __param(1, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, delete_push_subscription_dto_1.DeletePushSubscriptionDto]),
    __metadata("design:returntype", Promise)
], PushController.prototype, "deleteSubscription", null);
exports.PushController = PushController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [push_service_1.PushService])
], PushController);
