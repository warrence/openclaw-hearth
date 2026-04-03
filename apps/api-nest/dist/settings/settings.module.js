"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsModule = void 0;
const common_1 = require("@nestjs/common");
const auth_module_1 = require("../auth/auth.module");
const database_module_1 = require("../database/database.module");
const laravel_crypto_service_1 = require("./laravel-crypto.service");
const openclaw_config_writer_service_1 = require("./openclaw-config-writer.service");
const openclaw_gateway_health_service_1 = require("./openclaw-gateway-health.service");
const openclaw_model_catalog_service_1 = require("./openclaw-model-catalog.service");
const settings_controller_1 = require("./settings.controller");
const settings_repository_1 = require("./settings.repository");
const settings_service_1 = require("./settings.service");
let SettingsModule = class SettingsModule {
};
exports.SettingsModule = SettingsModule;
exports.SettingsModule = SettingsModule = __decorate([
    (0, common_1.Module)({
        imports: [auth_module_1.AuthModule, database_module_1.DatabaseModule],
        controllers: [settings_controller_1.SettingsController],
        providers: [
            laravel_crypto_service_1.LaravelCryptoService,
            openclaw_config_writer_service_1.OpenClawConfigWriterService,
            openclaw_gateway_health_service_1.OpenClawGatewayHealthService,
            openclaw_model_catalog_service_1.OpenClawModelCatalogService,
            settings_repository_1.SettingsRepository,
            settings_service_1.SettingsService,
        ],
        exports: [openclaw_config_writer_service_1.OpenClawConfigWriterService],
    })
], SettingsModule);
