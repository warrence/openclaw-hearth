import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { OpenClawConfig } from './openclaw';

export interface AgentConfig {
  agentId: string;
  displayName: string;
}

function detectAgentsFromConfig(): string[] {
  const agents: string[] = [];
  const configPaths = [
    path.join(os.homedir(), '.openclaw', 'openclaw.json'),
    path.join(os.homedir(), '.config', 'openclaw', 'openclaw.json'),
  ];

  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (config.agents?.entries) {
        agents.push(...Object.keys(config.agents.entries));
      }
      if (config.agents?.default && !agents.includes(config.agents.default)) {
        agents.unshift(config.agents.default);
      }
    } catch {
      continue;
    }
  }

  const agentsDir = path.join(os.homedir(), '.openclaw', 'agents');
  try {
    if (fs.existsSync(agentsDir)) {
      const dirs = fs.readdirSync(agentsDir).filter((d) => {
        return fs.statSync(path.join(agentsDir, d)).isDirectory() && !d.startsWith('.');
      });
      for (const d of dirs) {
        if (!agents.includes(d)) agents.push(d);
      }
    }
  } catch {
    // ignore
  }

  return agents;
}

export async function setupAgent(openclaw: OpenClawConfig): Promise<AgentConfig> {
  console.log('🤖  Agent configuration');
  console.log('');

  const detectedAgents = detectAgentsFromConfig();
  const allAgents = [...new Set([...openclaw.agents, ...detectedAgents])];

  let defaultAgent = 'main';
  if (allAgents.length > 0) {
    console.log('  Available agents:');
    allAgents.forEach((a) => console.log(`    - ${a}`));
    console.log('');
    defaultAgent = allAgents[0];
  } else {
    console.log('  No agents detected — using default "main" agent.');
    console.log('');
  }

  const { agentId } = await inquirer.prompt([
    {
      type: allAgents.length > 1 ? 'list' : 'input',
      name: 'agentId',
      message: 'Which OpenClaw agent should Hearth use?',
      choices: allAgents.length > 1 ? allAgents : undefined,
      default: defaultAgent,
    },
  ]);

  // Default display name: capitalize the agent ID (e.g. "main" → "Main")
  const defaultDisplayName = agentId.charAt(0).toUpperCase() + agentId.slice(1);

  const { displayName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'displayName',
      message: 'Display name for the agent in the app (e.g. Jarvis, Nova, Sage):',
      default: defaultDisplayName,
    },
  ]);

  console.log(`  ✓ Agent: ${displayName} (${agentId})`);
  console.log('');

  return {
    agentId,
    displayName,
  };
}
