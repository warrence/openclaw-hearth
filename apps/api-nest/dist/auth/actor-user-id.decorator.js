"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActorUserId = void 0;
const common_1 = require("@nestjs/common");
exports.ActorUserId = (0, common_1.createParamDecorator)((_data, context) => {
    const request = context.switchToHttp().getRequest();
    return request.headers['x-actor-user-id'];
});
