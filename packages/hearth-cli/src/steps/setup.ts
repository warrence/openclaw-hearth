import { setupDatabase } from './database';
import { setupOpenClaw } from './openclaw';
import { setupOwner } from './owner';
import { setupAgent } from './agent';
import { writeEnvFile } from './env';
import { installDependencies, buildWebApp, installPlugin } from './install';
import { runPersonalize } from './personalize';
import { setupNetwork } from './network';
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

  // Step 6: Install Hearth plugin into OpenClaw (generates channel token)
  const pluginTokens = await installPlugin();

  // Step 7: Write .env (includes all tokens)
  await writeEnvFile({ db, openclaw, agent, pluginTokens });

  // Step 8: Build web app
  await buildWebApp();

  // Step 9: Network & HTTPS
  const network = await setupNetwork();

  // Optional: Personalize (pass in the name already chosen)
  console.log('');
  const { personalize } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'personalize',
      message: 'Set up your assistant\'s personality now?',
      default: true,
    },
  ]);

  if (personalize) {
    await runPersonalize(agent.displayName);
  }

  console.log('');
  console.log('━'.repeat(50));
  console.log('✅  Hearth is installed!');
  console.log('');
  console.log('  ⚠️  Before you start chatting:');
  console.log('');
  console.log('  1. Set up your AI provider:');
  console.log('');
  console.log('     openclaw config');
  console.log('');
  console.log('     This will ask you to choose a model (e.g. OpenAI,');
  console.log('     Anthropic, Google) and sign in with OAuth.');
  console.log('     Without this, your assistant can\'t respond.');
  console.log('');
  console.log('  2. Start the OpenClaw gateway:');
  console.log('');
  console.log('     openclaw gateway start');
  console.log('');
  console.log('  3. Install Hearth as a background service (auto-start on boot):');
  console.log('');
  console.log('     npx hearth install-service');
  console.log('     npx hearth service start');
  console.log('');
  console.log('     Or start manually: npx hearth start');
  console.log('');
  console.log('  4. Open in your browser:');
  console.log('');
  console.log(`     ${network.publicUrl}`);
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
