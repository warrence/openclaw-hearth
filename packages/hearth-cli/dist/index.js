#!/usr/bin/env node
"use strict";
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
program.parse();
