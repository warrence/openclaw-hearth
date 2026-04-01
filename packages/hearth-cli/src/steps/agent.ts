import inquirer from 'inquirer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { OpenClawConfig } from './openclaw';

export interface AgentConfig {
  agentId: string;
  displayName: string;
  model?: string;
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

      // Check agents config
      if (config.agents?.entries) {
        agents.push(...Object.keys(config.agents.entries));
      }
      // Check default agent
      if (config.agents?.default && !agents.includes(config.agents.default)) {
        agents.unshift(config.agents.default);
      }
    } catch {
      continue;
    }
  }

  // Also check agents directory
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

function detectModelsFromConfig(): string[] {
  const configPaths = [
    path.join(os.homedir(), '.openclaw', 'openclaw.json'),
  ];

  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

      // Check if default model is set
      const models: string[] = [];
      if (config.agents?.defaults?.model) {
        models.push(config.agents.defaults.model);
      }
      return models;
    } catch {
      continue;
    }
  }

  return [];
}

export async function setupAgent(openclaw: OpenClawConfig): Promise<AgentConfig> {
  console.log('🤖  Step 4/4: Agent & model configuration');
  console.log('');

  // Auto-detect agents from OpenClaw config
  const detectedAgents = detectAgentsFromConfig();
  const allAgents = [...new Set([...openclaw.agents, ...detectedAgents])];

  let defaultAgent = 'main';
  if (allAgents.length > 0) {
    console.log('  Available agents:');
    allAgents.forEach((a) => console.log(`    - ${a}`));
    console.log('');
    defaultAgent = allAgents[0];
  } else {
    console.log('  No agents detected — you can create one later in OpenClaw.');
    console.log('');
  }

  const agentAnswers = await inquirer.prompt([
    {
      type: allAgents.length > 1 ? 'list' : 'input',
      name: 'agentId',
      message: 'Which OpenClaw agent should Hearth use?',
      choices: allAgents.length > 1 ? allAgents : undefined,
      default: defaultAgent,
    },
    {
      type: 'input',
      name: 'displayName',
      message: 'Display name for the agent in the app:',
      default: 'Assistant',
    },
  ]);

  console.log(`  ✓ Agent: ${agentAnswers.displayName} (${agentAnswers.agentId})`);

  // Model configuration
  console.log('');
  const detectedModels = detectModelsFromConfig();
  if (detectedModels.length > 0) {
    console.log(`  Current default model: ${detectedModels[0]}`);
  }

  const { configureModel } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'configureModel',
      message: 'Configure the AI model now?',
      default: detectedModels.length === 0,
    },
  ]);

  // Web search setup
  console.log('');
  console.log('  🔍 Web Search');
  console.log('');
  console.log('  Without web search, your assistant cannot look things up online.');
  console.log('  It won\'t be able to check the weather, search for recipes,');
  console.log('  look up prices, find news, or answer questions about current events.');
  console.log('');
  console.log('  Both options below are free and take 30 seconds to set up.');
  console.log('');
  const { searchProvider } = await inquirer.prompt([
    {
      type: 'list',
      name: 'searchProvider',
      message: 'Choose a web search provider:',
      choices: [
        { name: 'Tavily — AI-optimized search, 1,000 free searches/month (recommended)', value: 'tavily' },
        { name: 'Brave Search — 2,000 free searches/month', value: 'brave' },
        { name: 'Skip — my assistant won\'t be able to search the web', value: 'skip' },
      ],
    },
  ]);

  if (searchProvider !== 'skip') {
    const providerInfo: Record<string, { url: string; envKey: string }> = {
      tavily: { url: 'https://tavily.com (sign up for free API key)', envKey: 'TAVILY_API_KEY' },
      brave: { url: 'https://brave.com/search/api/', envKey: 'BRAVE_API_KEY' },
    };

    const info = providerInfo[searchProvider];
    console.log('');
    console.log(`  Get a free API key at: ${info.url}`);
    console.log('');

    const { searchApiKey } = await inquirer.prompt([
      {
        type: 'input',
        name: 'searchApiKey',
        message: `${searchProvider === 'tavily' ? 'Tavily' : 'Brave'} API key (or press Enter to skip):`,
      },
    ]);

    if (searchApiKey?.trim()) {
      const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
      try {
        const config = fs.existsSync(configPath)
          ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          : {};
        if (!config.auth) config.auth = {};
        if (!config.auth.env) config.auth.env = {};
        config.auth.env[info.envKey] = searchApiKey.trim();
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`  ✓ Web search enabled (${searchProvider})`);
      } catch {
        console.log(`  ⚠ Could not save — add ${info.envKey} to ~/.openclaw/openclaw.json manually`);
      }
    } else {
      console.log('  → Skipped — you can add it later in ~/.openclaw/openclaw.json');
    }
  }

  let model: string | undefined;
  if (configureModel) {
    console.log('');
    console.log('  Common models:');
    console.log('    - anthropic/claude-sonnet-4-5    (Anthropic — balanced)');
    console.log('    - anthropic/claude-haiku-4-5     (Anthropic — fast & cheap)');
    console.log('    - openai/gpt-4o                  (OpenAI — balanced)');
    console.log('    - openai/gpt-4o-mini             (OpenAI — fast & cheap)');
    console.log('    - google/gemini-2.5-flash         (Google — fast)');
    console.log('');

    const modelAnswers = await inquirer.prompt([
      {
        type: 'input',
        name: 'model',
        message: 'Default model (provider/model):',
        default: detectedModels[0] ?? 'anthropic/claude-sonnet-4-5',
      },
      {
        type: 'input',
        name: 'apiKey',
        message: 'API key for this provider:',
        validate: (v: string) => v.trim().length > 0 || 'API key is required for the model to work',
      },
    ]);

    model = modelAnswers.model;

    // Write the model + API key to openclaw.json
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    try {
      const config = fs.existsSync(configPath)
        ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        : {};

      // Set default model
      if (!config.agents) config.agents = {};
      if (!config.agents.defaults) config.agents.defaults = {};
      config.agents.defaults.model = modelAnswers.model;

      // Set API key based on provider
      const provider = modelAnswers.model.split('/')[0];
      if (!config.auth) config.auth = {};

      const providerKeyMap: Record<string, string> = {
        anthropic: 'ANTHROPIC_API_KEY',
        openai: 'OPENAI_API_KEY',
        google: 'GEMINI_API_KEY',
      };

      const envKey = providerKeyMap[provider];
      if (envKey) {
        if (!config.auth.env) config.auth.env = {};
        config.auth.env[envKey] = modelAnswers.apiKey;
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      console.log(`  ✓ Model configured: ${modelAnswers.model}`);
      console.log(`  ✓ API key saved to ~/.openclaw/openclaw.json`);
    } catch (err) {
      console.log(`  ⚠ Could not save model config — set it manually in ~/.openclaw/openclaw.json`);
    }
  }

  console.log('');

  return {
    agentId: agentAnswers.agentId,
    displayName: agentAnswers.displayName,
    model,
  };
}
