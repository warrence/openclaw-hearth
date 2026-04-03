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
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const current_user_decorator_1 = require("./current-user.decorator");
const current_user_decorator_2 = require("./current-user.decorator");
const login_dto_1 = require("./dto/login.dto");
const auth_repository_1 = require("./auth.repository");
const auth_service_1 = require("./auth.service");
const session_auth_guard_1 = require("./session-auth.guard");
const session_cookie_service_1 = require("./session-cookie.service");
const webauthn_service_1 = require("./webauthn.service");
let AuthController = class AuthController {
    authService;
    authRepository;
    sessionCookieService;
    webAuthnService;
    constructor(authService, authRepository, sessionCookieService, webAuthnService) {
        this.authService = authService;
        this.authRepository = authRepository;
        this.sessionCookieService = sessionCookieService;
        this.webAuthnService = webAuthnService;
    }
    async login(body, response) {
        const user = await this.authService.login(body.profile_id, body.pin);
        response.setHeader('Set-Cookie', this.sessionCookieService.createSessionCookie(user.id));
        return user;
    }
    me(user) {
        return user;
    }
    logout(response) {
        response.setHeader('Set-Cookie', this.sessionCookieService.clearSessionCookie());
        return { ok: true };
    }
    async webAuthnRegisterOptions(userId, user) {
        return this.webAuthnService.getRegistrationOptions(userId, user.name);
    }
    async webAuthnRegister(userId, body) {
        return this.webAuthnService.verifyRegistration(userId, body);
    }
    async webAuthnLoginOptions(profileId) {
        const id = Number.parseInt(profileId, 10);
        if (!id)
            throw new common_1.BadRequestException('profile_id is required');
        const user = await this.authRepository.findUserForAuth(id);
        if (!user || !user.is_active)
            throw new common_1.UnauthorizedException('Profile not found.');
        return this.webAuthnService.getAuthenticationOptions(user.id);
    }
    async webAuthnLogin(body, response) {
        const user = await this.authRepository.findUserForAuth(body.profile_id);
        if (!user || !user.is_active)
            throw new common_1.UnauthorizedException('Profile not found.');
        await this.webAuthnService.verifyAuthentication(user.id, body.response);
        await this.authRepository.updateLastLoginAt(user.id);
        const refreshed = await this.authRepository.findUserForAuth(user.id);
        if (!refreshed)
            throw new common_1.UnauthorizedException('Profile not found.');
        const { pin_hash: _ph, ...authUser } = refreshed;
        response.setHeader('Set-Cookie', this.sessionCookieService.createSessionCookie(authUser.id));
        return authUser;
    }
    async webAuthnListCredentials(userId) {
        return this.webAuthnService.listCredentials(userId);
    }
    async webAuthnDeleteCredential(userId, credentialId) {
        await this.webAuthnService.deleteCredential(userId, credentialId);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, common_1.Post)('login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [login_dto_1.LoginDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "login", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], AuthController.prototype, "me", null);
__decorate([
    (0, common_1.Post)('logout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Object)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Post)('webauthn/register-options'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __param(0, (0, current_user_decorator_2.CurrentUserId)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "webAuthnRegisterOptions", null);
__decorate([
    (0, common_1.Post)('webauthn/register'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __param(0, (0, current_user_decorator_2.CurrentUserId)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "webAuthnRegister", null);
__decorate([
    (0, common_1.Get)('webauthn/login-options'),
    __param(0, (0, common_1.Query)('profile_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "webAuthnLoginOptions", null);
__decorate([
    (0, common_1.Post)('webauthn/login'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)({ passthrough: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "webAuthnLogin", null);
__decorate([
    (0, common_1.Get)('webauthn/credentials'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __param(0, (0, current_user_decorator_2.CurrentUserId)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "webAuthnListCredentials", null);
__decorate([
    (0, common_1.Delete)('webauthn/credentials/:credentialId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __param(0, (0, current_user_decorator_2.CurrentUserId)()),
    __param(1, (0, common_1.Param)('credentialId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "webAuthnDeleteCredential", null);
exports.AuthController = AuthController = __decorate([
    (0, common_1.Controller)('api/auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService,
        auth_repository_1.AuthRepository,
        session_cookie_service_1.SessionCookieService,
        webauthn_service_1.WebAuthnService])
], AuthController);
