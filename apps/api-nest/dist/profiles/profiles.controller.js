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
exports.ProfilesController = void 0;
const common_1 = require("@nestjs/common");
const owner_auth_guard_1 = require("../auth/owner-auth.guard");
const session_auth_guard_1 = require("../auth/session-auth.guard");
const create_profile_dto_1 = require("./dto/create-profile.dto");
const set_profile_pin_dto_1 = require("./dto/set-profile-pin.dto");
const update_profile_dto_1 = require("./dto/update-profile.dto");
const profiles_service_1 = require("./profiles.service");
let ProfilesController = class ProfilesController {
    profilesService;
    constructor(profilesService) {
        this.profilesService = profilesService;
    }
    listProfiles() {
        return this.profilesService.listProfiles();
    }
    createProfile(body) {
        return this.profilesService.createProfile(body);
    }
    updateProfile(profileId, body) {
        return this.profilesService.updateProfile(profileId, body);
    }
    setPin(profileId, body) {
        return this.profilesService.setPin(profileId, body);
    }
    resetPin(profileId) {
        return this.profilesService.resetPin(profileId);
    }
    deleteProfile(profileId) {
        return this.profilesService.deleteProfile(profileId);
    }
};
exports.ProfilesController = ProfilesController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProfilesController.prototype, "listProfiles", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_profile_dto_1.CreateProfileDto]),
    __metadata("design:returntype", Promise)
], ProfilesController.prototype, "createProfile", null);
__decorate([
    (0, common_1.Patch)(':profileId'),
    __param(0, (0, common_1.Param)('profileId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, update_profile_dto_1.UpdateProfileDto]),
    __metadata("design:returntype", Promise)
], ProfilesController.prototype, "updateProfile", null);
__decorate([
    (0, common_1.Post)(':profileId/set-pin'),
    __param(0, (0, common_1.Param)('profileId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, set_profile_pin_dto_1.SetProfilePinDto]),
    __metadata("design:returntype", Promise)
], ProfilesController.prototype, "setPin", null);
__decorate([
    (0, common_1.Post)(':profileId/reset-pin'),
    __param(0, (0, common_1.Param)('profileId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ProfilesController.prototype, "resetPin", null);
__decorate([
    (0, common_1.Delete)(':profileId'),
    __param(0, (0, common_1.Param)('profileId', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ProfilesController.prototype, "deleteProfile", null);
exports.ProfilesController = ProfilesController = __decorate([
    (0, common_1.Controller)('api/profiles'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard, owner_auth_guard_1.OwnerAuthGuard),
    __metadata("design:paramtypes", [profiles_service_1.ProfilesService])
], ProfilesController);
