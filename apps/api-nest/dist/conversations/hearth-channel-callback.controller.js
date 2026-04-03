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
exports.HearthChannelCallbackController = void 0;
const common_1 = require("@nestjs/common");
const conversation_assistant_execution_service_1 = require("./conversation-assistant-execution.service");
let HearthChannelCallbackController = class HearthChannelCallbackController {
    executionService;
    constructor(executionService) {
        this.executionService = executionService;
    }
    async handleCallback(token, body) {
        if (!body || typeof body.event !== 'string') {
            throw new common_1.BadRequestException('Invalid callback payload.');
        }
        const handled = await this.executionService.processHearthCallback(token, body);
        if (!handled) {
            return { ok: false };
        }
        return { ok: true };
    }
};
exports.HearthChannelCallbackController = HearthChannelCallbackController;
__decorate([
    (0, common_1.Post)('callback/:token'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Param)('token')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], HearthChannelCallbackController.prototype, "handleCallback", null);
exports.HearthChannelCallbackController = HearthChannelCallbackController = __decorate([
    (0, common_1.Controller)('api/channel/hearth-app'),
    __metadata("design:paramtypes", [conversation_assistant_execution_service_1.ConversationAssistantExecutionService])
], HearthChannelCallbackController);
