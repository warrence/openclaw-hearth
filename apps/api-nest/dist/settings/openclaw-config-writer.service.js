"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var OpenClawConfigWriterService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenClawConfigWriterService = void 0;
const common_1 = require("@nestjs/common");
const node_fs_1 = require("node:fs");
const node_os_1 = require("node:os");
const node_path_1 = require("node:path");
const HEARTH_CONFIG_PATH = (0, node_path_1.join)((0, node_os_1.homedir)(), '.openclaw', 'hearth.json');
let OpenClawConfigWriterService = OpenClawConfigWriterService_1 = class OpenClawConfigWriterService {
    logger = new common_1.Logger(OpenClawConfigWriterService_1.name);
    read() {
        try {
            const raw = (0, node_fs_1.readFileSync)(HEARTH_CONFIG_PATH, 'utf8');
            return JSON.parse(raw);
        }
        catch {
            return {};
        }
    }
    patch(patch) {
        const current = this.read();
        const merged = deepMerge(current, patch);
        try {
            (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(HEARTH_CONFIG_PATH), { recursive: true });
            (0, node_fs_1.writeFileSync)(HEARTH_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
        }
        catch (err) {
            this.logger.error(`Failed to write hearth.json: ${String(err)}`);
            throw err;
        }
    }
    get(path) {
        const obj = this.read();
        return getNestedValue(obj, path.split('.'));
    }
};
exports.OpenClawConfigWriterService = OpenClawConfigWriterService;
exports.OpenClawConfigWriterService = OpenClawConfigWriterService = OpenClawConfigWriterService_1 = __decorate([
    (0, common_1.Injectable)()
], OpenClawConfigWriterService);
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        const sv = source[key];
        const tv = target[key];
        if (sv !== null &&
            typeof sv === 'object' &&
            !Array.isArray(sv) &&
            tv !== null &&
            typeof tv === 'object' &&
            !Array.isArray(tv)) {
            result[key] = deepMerge(tv, sv);
        }
        else {
            result[key] = sv;
        }
    }
    return result;
}
function getNestedValue(obj, keys) {
    if (keys.length === 0 || obj === null || typeof obj !== 'object') {
        return obj;
    }
    const head = keys[0];
    const rest = keys.slice(1);
    if (head === undefined)
        return obj;
    const next = obj[head];
    return rest.length === 0 ? next : getNestedValue(next, rest);
}
