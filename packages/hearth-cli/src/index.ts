#!/usr/bin/env node
import { Command } from 'commander';
import { runSetup } from './steps/setup';
import { runStart } from './steps/start';
import { runPersonalize } from './steps/personalize';
import { runUpdate } from './steps/update';
import { runInstallService } from './steps/service';

const program = new Command();

program
  .name('hearth')
  .description('Hearth — household assistant CLI')
  .version('0.1.0');

program
  .command('setup')
  .description('Interactive setup wizard for Hearth')
  .action(async () => {
    await runSetup();
  });

program
  .command('start')
  .description('Start Hearth (API + web server)')
  .option('-p, --port <port>', 'Web server port', '9100')
  .option('--api-port <port>', 'API server port', '3001')
  .action(async (opts) => {
    await runStart(opts);
  });

program
  .command('personalize')
  .description('Create a personality profile for your assistant')
  .action(async () => {
    await runPersonalize();
  });

program
  .command('update')
  .description('Update Hearth to the latest version')
  .action(async () => {
    await runUpdate();
  });

program
  .command('install-service')
  .description('Install Hearth as a background service (systemd/launchd)')
  .action(async () => {
    await runInstallService();
  });

program.parse();
