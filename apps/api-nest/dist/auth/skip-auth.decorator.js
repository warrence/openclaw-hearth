"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkipAuth = exports.SKIP_AUTH_KEY = void 0;
const common_1 = require("@nestjs/common");
exports.SKIP_AUTH_KEY = 'skipAuth';
const SkipAuth = () => (0, common_1.SetMetadata)(exports.SKIP_AUTH_KEY, true);
exports.SkipAuth = SkipAuth;
