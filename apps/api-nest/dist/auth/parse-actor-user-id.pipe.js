"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ParseActorUserIdPipe = void 0;
const common_1 = require("@nestjs/common");
let ParseActorUserIdPipe = class ParseActorUserIdPipe {
    transform(value) {
        if (typeof value !== 'string' || value.trim() === '') {
            throw new common_1.UnauthorizedException('Temporary migration auth requires x-actor-user-id.');
        }
        const parsed = Number.parseInt(value, 10);
        if (!Number.isInteger(parsed) || parsed <= 0) {
            throw new common_1.UnauthorizedException('Temporary migration auth requires a valid x-actor-user-id.');
        }
        return parsed;
    }
};
exports.ParseActorUserIdPipe = ParseActorUserIdPipe;
exports.ParseActorUserIdPipe = ParseActorUserIdPipe = __decorate([
    (0, common_1.Injectable)()
], ParseActorUserIdPipe);
