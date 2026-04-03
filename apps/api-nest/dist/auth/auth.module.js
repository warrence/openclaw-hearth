"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthModule = void 0;
const common_1 = require("@nestjs/common");
const database_module_1 = require("../database/database.module");
const auth_controller_1 = require("./auth.controller");
const auth_repository_1 = require("./auth.repository");
const auth_service_1 = require("./auth.service");
const auth_session_middleware_1 = require("./auth-session.middleware");
const owner_auth_guard_1 = require("./owner-auth.guard");
const pin_hash_service_1 = require("./pin-hash.service");
const pin_hash_verifier_service_1 = require("./pin-hash-verifier.service");
const session_auth_guard_1 = require("./session-auth.guard");
const session_cookie_service_1 = require("./session-cookie.service");
const users_controller_1 = require("./users.controller");
const webauthn_service_1 = require("./webauthn.service");
let AuthModule = class AuthModule {
    configure(consumer) {
        consumer.apply(auth_session_middleware_1.AuthSessionMiddleware).forRoutes('*');
    }
};
exports.AuthModule = AuthModule;
exports.AuthModule = AuthModule = __decorate([
    (0, common_1.Module)({
        imports: [database_module_1.DatabaseModule],
        controllers: [auth_controller_1.AuthController, users_controller_1.UsersController],
        providers: [
            auth_repository_1.AuthRepository,
            auth_service_1.AuthService,
            auth_session_middleware_1.AuthSessionMiddleware,
            owner_auth_guard_1.OwnerAuthGuard,
            pin_hash_service_1.PinHashService,
            pin_hash_verifier_service_1.PinHashVerifierService,
            session_auth_guard_1.SessionAuthGuard,
            session_cookie_service_1.SessionCookieService,
            webauthn_service_1.WebAuthnService,
        ],
        exports: [
            auth_repository_1.AuthRepository,
            auth_session_middleware_1.AuthSessionMiddleware,
            owner_auth_guard_1.OwnerAuthGuard,
            pin_hash_service_1.PinHashService,
            session_auth_guard_1.SessionAuthGuard,
        ],
    })
], AuthModule);
