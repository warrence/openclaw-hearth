"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    const configService = app.get(config_1.ConfigService);
    const config = configService.getOrThrow('app', {
        infer: true,
    });
    const storageRoot = process.env.ATTACHMENTS_STORAGE_ROOT
        ? (0, node_path_1.resolve)(process.cwd(), process.env.ATTACHMENTS_STORAGE_ROOT)
        : (0, node_path_1.join)(process.cwd(), 'storage');
    app.useStaticAssets(storageRoot, { prefix: '/storage' });
    if (config.prefix) {
        app.setGlobalPrefix(config.prefix);
    }
    app.enableCors({
        origin: true,
        credentials: true,
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
    }));
    await app.listen(config?.port ?? 3001, config?.host ?? '0.0.0.0');
}
void bootstrap();
