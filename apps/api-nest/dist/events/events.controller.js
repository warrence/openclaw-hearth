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
exports.EventsController = void 0;
const common_1 = require("@nestjs/common");
const session_auth_guard_1 = require("../auth/session-auth.guard");
const event_bus_service_1 = require("./event-bus.service");
let EventsController = class EventsController {
    eventBus;
    constructor(eventBus) {
        this.eventBus = eventBus;
    }
    streamEvents(userId, res) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });
        res.write(`event: connected\ndata: ${JSON.stringify({ userId })}\n\n`);
        const keepAlive = setInterval(() => {
            res.write(`: keep-alive\n\n`);
        }, 30000);
        const subscription = this.eventBus.forUser(userId).subscribe((event) => {
            res.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
        });
        res.on('close', () => {
            clearInterval(keepAlive);
            subscription.unsubscribe();
        });
    }
};
exports.EventsController = EventsController;
__decorate([
    (0, common_1.Get)('users/:userId/events'),
    __param(0, (0, common_1.Param)('userId', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], EventsController.prototype, "streamEvents", null);
exports.EventsController = EventsController = __decorate([
    (0, common_1.Controller)('api'),
    (0, common_1.UseGuards)(session_auth_guard_1.SessionAuthGuard),
    __metadata("design:paramtypes", [event_bus_service_1.EventBusService])
], EventsController);
