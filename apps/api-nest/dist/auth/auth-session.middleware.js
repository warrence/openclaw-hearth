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
exports.AuthSessionMiddleware = void 0;
const common_1 = require("@nestjs/common");
const auth_repository_1 = require("./auth.repository");
const session_cookie_service_1 = require("./session-cookie.service");
let AuthSessionMiddleware = class AuthSessionMiddleware {
    authRepository;
    sessionCookieService;
    constructor(authRepository, sessionCookieService) {
        this.authRepository = authRepository;
        this.sessionCookieService = sessionCookieService;
    }
    async use(request, _response, next) {
        const userId = this.sessionCookieService.readUserIdFromCookieHeader(request.headers?.cookie);
        if (userId) {
            const user = await this.authRepository.findUserForAuth(userId);
            if (user?.is_active) {
                const { pin_hash: _pinHash, ...authUser } = user;
                request.authUser = authUser;
            }
        }
        next();
    }
};
exports.AuthSessionMiddleware = AuthSessionMiddleware;
exports.AuthSessionMiddleware = AuthSessionMiddleware = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [auth_repository_1.AuthRepository,
        session_cookie_service_1.SessionCookieService])
], AuthSessionMiddleware);
