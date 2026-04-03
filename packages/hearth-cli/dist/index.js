#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const setup_1 = require("./steps/setup");
const start_1 = require("./steps/start");
const personalize_1 = require("./steps/personalize");
const update_1 = require("./steps/update");
const service_1 = require("./steps/service");
const program = new commander_1.Command();
program
    .name('hearth')
    .description('Hearth — household assistant CLI')
    .version('0.1.0');
program
    .command('setup')
    .description('Interactive setup wizard for Hearth')
    .action(async () => {
    await (0, setup_1.runSetup)();
});
program
    .command('start')
    .description('Start Hearth (API + web server)')
    .option('-p, --port <port>', 'Web server port', '9100')
    .option('--api-port <port>', 'API server port', '3001')
    .action(async (opts) => {
    await (0, start_1.runStart)(opts);
});
program
    .command('personalize')
    .description('Create a personality profile for your assistant')
    .action(async () => {
    await (0, personalize_1.runPersonalize)();
});
program
    .command('update')
    .description('Update Hearth to the latest version')
    .action(async () => {
    await (0, update_1.runUpdate)();
});
program
    .command('install-service')
    .description('Install Hearth as a background service (systemd/launchd)')
    .action(async () => {
    await (0, service_1.runInstallService)();
});
program
    .command('service')
    .description('Manage the Hearth background service')
    .argument('<action>', 'start | stop | restart | status | logs')
    .action(async (action) => {
    const { manageService } = await Promise.resolve().then(() => __importStar(require('./steps/service')));
    await manageService(action);
});
program.parse();
