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
exports.SettingsController = void 0;
const common_1 = require("@nestjs/common");
const owner_auth_guard_1 = require("../auth/owner-auth.guard");
const session_auth_guard_1 = require("../auth/session-auth.guard");
const test_gateway_connection_dto_1 = require("./dto/test-gateway-connection.dto");
const update_gateway_config_dto_1 = require("./dto/update-gateway-config.dto");
const update_model_preset_settings_dto_1 = require("./dto/update-model-preset-settings.dto");
const settings_service_1 = require("./settings.service");
let SettingsController = class SettingsController {
    settingsService;
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    getOpenClawModelOptions() {
        return this.settingsService.getOpenClawModelOptions();
    }
    getModelPresetSettings() {
        return this.settingsService.getModelPresetSettings();
    }
    updateModelPresetSettings(body) {
        return this.settingsService.updateModelPresetSettings(body);
    }
    getGatewayStatus() {
        return this.settingsService.getGatewayStatus();
    }
    testGatewayConnection(body) {
        return this.settingsService.testGatewayConnection(body);
    }
    updateGatewayConfig(body) {
        return this.settingsService.updateGatewayConfig(body);
    }
    getAgentDisplayInfo() {
        const name = this.settingsService.getAgentDisplayName();
        return { agentDisplayName: name };
    }
    getAgentSettings() {
        return this.settingsService.getAgentSettings();
    }
    updateAgentSettings(body) {
        return this.settingsService.updateAgentSettings(body.hearthAgentId);
    }
    updateAgentDisplayName(body) {
        return this.settingsService.updateAgentDisplayName(body.name);
    }
    getReminderSettings() {
        return this.settingsService.getReminderSettings();
    }
    updateReminderSettings(body) {
        return this.settingsService.updateReminderSettings(body.critical);
    }
};
exports.SettingsController = SettingsController;
__decorate([
    (0, common_1.Get)('openclaw-model-options'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getOpenClawModelOptions", null);
__decorate([
    (0, common_1.Get)('model-preset-settings'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getModelPresetSettings", null);
__decorate([
    (0, common_1.Patch)('model-preset-settings'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_model_preset_settings_dto_1.UpdateModelPresetSettingsDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateModelPresetSettings", null);
__decorate([
    (0, common_1.Get)('gateway/status'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getGatewayStatus", null);
__decorate([
    (0, common_1.Post)('gateway/test-connection'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [test_gateway_connection_dto_1.TestGatewayConnectionDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "testGatewayConnection", null);
__decorate([
    (0, common_1.Put)('gateway/config'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [update_gateway_config_dto_1.UpdateGatewayConfigDto]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateGatewayConfig", null);
__decorate([
    (0, common_1.Get)('agent-display-info'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], SettingsController.prototype, "getAgentDisplayInfo", null);
__decorate([
    (0, common_1.Get)('agent-settings'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "getAgentSettings", null);
__decorate([
    (0, common_1.Put)('agent-settings'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateAgentSettings", null);
__decorate([
    (0, common_1.Put)('agent-display-name'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SettingsController.prototype, "updateAgentDisplayName", null);
__decorate([
    (0, common_1.Get)('reminder-settings'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Object)
], SettingsController.prototype, "getReminderSettings", null);
__decorate([
    (0, common_1.Put)('reminder-settings'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], SettingsController.prototype, "updateReminderSettings", null);
exports.SettingsController = SettingsController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [settings_service_1.SettingsService])
], SettingsController);
