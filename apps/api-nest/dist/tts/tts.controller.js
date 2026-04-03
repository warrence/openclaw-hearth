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
exports.TtsController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let TtsController = class TtsController {
    configService;
    constructor(configService) {
        this.configService = configService;
    }
    async speak(body, res) {
        const text = body?.text?.trim();
        if (!text) {
            res.status(400).json({ message: 'Text is required.' });
            return;
        }
        try {
            const config = this.configService.get('openclaw');
            const inboundUrl = config?.hearthChannelInboundUrl ?? 'http://127.0.0.1:18789/channel/hearth-app/inbound';
            const ttsUrl = inboundUrl.replace(/\/inbound$/, '/tts');
            const token = config?.hearthChannelToken ?? '';
            const response = await fetch(ttsUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, text }),
                signal: AbortSignal.timeout(30000),
            });
            if (!response.ok || !response.body) {
                const err = await response.text().catch(() => 'TTS failed');
                res.status(response.status || 502).json({ message: err });
                return;
            }
            const contentType = response.headers.get('content-type') || 'audio/mpeg';
            res.setHeader('Content-Type', contentType);
            res.send(Buffer.from(await response.arrayBuffer()));
        }
        catch (err) {
            res.status(500).json({
                message: err instanceof Error ? err.message : 'TTS failed',
            });
        }
    }
};
exports.TtsController = TtsController;
__decorate([
    (0, common_1.Post)('tts/speak'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TtsController.prototype, "speak", null);
exports.TtsController = TtsController = __decorate([
    (0, common_1.Controller)('api'),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TtsController);
