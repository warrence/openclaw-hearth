import inquirer from 'inquirer';
import type { OpenClawConfig } from './openclaw';

export interface AgentConfig {
  agentId: string;
  displayName: string;
}

export async function setupAgent(openclaw: OpenClawConfig): Promise<AgentConfig> {
  console.log('🤖  Step 4/4: Agent configuration');
  console.log('');

  let defaultAgent = 'daughter-aeris';
  if (openclaw.agents.length > 0) {
    console.log('  Available agents:');
    openclaw.agents.forEach((a) => console.log(`    - ${a}`));
    console.log('');
    defaultAgent = openclaw.agents[0];
  }

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'agentId',
      message: 'OpenClaw agent ID:',
      default: defaultAgent,
    },
    {
      type: 'input',
      name: 'displayName',
      message: 'Display name in app:',
      default: 'Aeris',
    },
  ]);

  console.log(`  ✓ Agent configured: ${answers.displayName} (${answers.agentId})`);
  console.log('');

  return {
    agentId: answers.agentId,
    displayName: answers.displayName,
  };
}
