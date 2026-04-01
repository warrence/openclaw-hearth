import { setupDatabase } from './database';
import { setupOpenClaw } from './openclaw';
import { setupOwner } from './owner';
import { setupAgent } from './agent';
import { writeEnvFile } from './env';
import { installDependencies, buildWebApp, installPlugin } from './install';
import { runPersonalize } from './personalize';
import inquirer from 'inquirer';

export async function runSetup(): Promise<void> {
  console.log('');
  console.log('🏠  Welcome to Hearth — household assistant setup');
  console.log('─'.repeat(50));
  console.log('');

  // Step 1: Install dependencies
  await installDependencies();

  // Step 2: Database
  const db = await setupDatabase();

  // Step 3: OpenClaw (install + run openclaw setup for model/auth)
  const openclaw = await setupOpenClaw();

  // Step 4: Owner account
  await setupOwner(db);

  // Step 5: Agent config
  const agent = await setupAgent(openclaw);

  // Step 6: Install Hearth plugin into OpenClaw
  await installPlugin();

  // Step 7: Write .env
  await writeEnvFile({ db, openclaw, agent });

  // Step 8: Build web app
  await buildWebApp();

  // Optional: Personalize
  console.log('');
  const { personalize } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'personalize',
      message: 'Give your assistant a name and personality now?',
      default: true,
    },
  ]);

  if (personalize) {
    await runPersonalize();
  }

  console.log('');
  console.log('━'.repeat(50));
  console.log('✅  Hearth is ready!');
  console.log('');
  console.log('  Start:   npx hearth start');
  console.log('  Open:    http://localhost:9100');
  console.log('');
  console.log('  📖 Enhance your assistant:');
  console.log('     docs/enhance-your-assistant.md');
  if (!personalize) {
    console.log('  🎭 Personalize later:');
    console.log('     npx hearth personalize');
  }
  console.log('━'.repeat(50));
  console.log('');

  db.client.end();
}
