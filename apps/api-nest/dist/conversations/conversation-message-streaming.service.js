"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationMessageStreamingService = void 0;
const common_1 = require("@nestjs/common");
let ConversationMessageStreamingService = class ConversationMessageStreamingService {
    startSse(res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
    }
    writeEvent(res, event) {
        res.write(this.serializeEvent(event));
    }
    endSse(res) {
        res.end();
    }
    serializeEvent(event) {
        return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
    }
};
exports.ConversationMessageStreamingService = ConversationMessageStreamingService;
exports.ConversationMessageStreamingService = ConversationMessageStreamingService = __decorate([
    (0, common_1.Injectable)()
], ConversationMessageStreamingService);
