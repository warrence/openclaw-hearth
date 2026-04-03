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
exports.UpdateGatewayConfigDto = void 0;
const class_validator_1 = require("class-validator");
class UpdateGatewayConfigDto {
    name;
    base_url;
    token;
}
exports.UpdateGatewayConfigDto = UpdateGatewayConfigDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpdateGatewayConfigDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsUrl)({
        require_tld: false,
        protocols: ['http', 'https', 'ws', 'wss'],
    }),
    (0, class_validator_1.MaxLength)(2048),
    __metadata("design:type", String)
], UpdateGatewayConfigDto.prototype, "base_url", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(4096),
    __metadata("design:type", String)
], UpdateGatewayConfigDto.prototype, "token", void 0);
