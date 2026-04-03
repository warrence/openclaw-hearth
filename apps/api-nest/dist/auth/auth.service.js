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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const auth_repository_1 = require("./auth.repository");
const pin_hash_verifier_service_1 = require("./pin-hash-verifier.service");
let AuthService = class AuthService {
    authRepository;
    pinHashVerifierService;
    constructor(authRepository, pinHashVerifierService) {
        this.authRepository = authRepository;
        this.pinHashVerifierService = pinHashVerifierService;
    }
    async login(profileId, pin) {
        const user = await this.authRepository.findUserForAuth(profileId);
        if (!user || !user.is_active) {
            throw new common_1.UnauthorizedException('Profile not found or inactive.');
        }
        if (!user.pin_hash ||
            !(await this.pinHashVerifierService.verify(pin, user.pin_hash))) {
            throw new common_1.UnauthorizedException('Invalid PIN.');
        }
        await this.authRepository.updateLastLoginAt(user.id);
        const refreshedUser = await this.authRepository.findUserForAuth(user.id);
        if (!refreshedUser) {
            throw new common_1.UnauthorizedException('Profile not found or inactive.');
        }
        const { pin_hash: _pinHash, ...authUser } = refreshedUser;
        return authUser;
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_repository_1.AuthRepository,
        pin_hash_verifier_service_1.PinHashVerifierService])
], AuthService);
