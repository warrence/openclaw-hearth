import inquirer from 'inquirer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface OpenClawConfig {
  baseUrl: string;
  token: string;
  agents: string[];
}

export async function setupOpenClaw(): Promise<OpenClawConfig> {
  console.log('🔗  Step 2/4: OpenClaw');
  console.log('');

  // Try to auto-detect OpenClaw
  const detected = detectOpenClaw();

  if (detected) {
    console.log(`  ✓ Found OpenClaw at ${detected.baseUrl}`);
    if (detected.token) {
      console.log('  ✓ Token auto-detected');
    }

    const { useDetected } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'useDetected',
        message: 'Use detected OpenClaw configuration?',
        default: true,
      },
    ]);

    if (useDetected) {
      const agents = await fetchAgents(detected.baseUrl, detected.token);
      console.log('  ✓ OpenClaw configured');
      console.log('');
      return { ...detected, agents };
    }
  }

  // Ask user if they have OpenClaw installed
  const { hasOpenClaw } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'hasOpenClaw',
      message: 'Do you have OpenClaw installed?',
      default: false,
    },
  ]);

  if (!hasOpenClaw) {
    const { installNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installNow',
        message: 'Install OpenClaw now? (requires npm)',
        default: true,
      },
    ]);

    if (installNow) {
      console.log('  → Installing OpenClaw...');
      try {
        execSync('npm install -g openclaw', { stdio: 'inherit' });
        console.log('  ✓ OpenClaw installed');
      } catch {
        console.error('  ✗ Installation failed. Please install OpenClaw manually:');
        console.log('    npm install -g openclaw');
        process.exit(1);
      }

      // Run openclaw setup automatically
      console.log('  → Running OpenClaw initial setup...');
      try {
        execSync('openclaw setup --non-interactive 2>/dev/null || openclaw setup 2>/dev/null || true', {
          stdio: 'inherit',
          timeout: 30000,
        });
      } catch {
        console.log('  ⚠ OpenClaw setup may need manual configuration later');
      }

      // Re-detect after install
      const freshDetected = detectOpenClaw();
      if (freshDetected) {
        const agents = await fetchAgents(freshDetected.baseUrl, freshDetected.token);
        console.log(`  ✓ OpenClaw configured at ${freshDetected.baseUrl}`);
        console.log('');
        return { ...freshDetected, agents };
      }

      // Fall through to manual config
    } else {
      console.log('');
      console.log('  ⚠ Hearth requires OpenClaw to work.');
      console.log('  You can install it later with: npm install -g openclaw');
      console.log('');
    }
  }

  // Manual configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'baseUrl',
      message: 'OpenClaw gateway URL:',
      default: 'http://127.0.0.1:18789',
    },
    {
      type: 'password',
      name: 'token',
      message: 'Gateway token:',
    },
  ]);

  // Test connection
  try {
    const res = await fetch(`${answers.baseUrl}/health`);
    if (res.ok) {
      console.log('  ✓ Connected to OpenClaw gateway');
    } else {
      console.log(`  ⚠ Gateway responded with status ${res.status}`);
    }
  } catch {
    console.log('  ⚠ Could not reach gateway — make sure OpenClaw is running');
  }

  const agents = await fetchAgents(answers.baseUrl, answers.token);
  console.log('  ✓ OpenClaw configured');
  console.log('');

  return {
    baseUrl: answers.baseUrl,
    token: answers.token,
    agents,
  };
}

function detectOpenClaw(): { baseUrl: string; token: string } | null {
  // Check common config locations
  const configPaths = [
    path.join(os.homedir(), '.openclaw', 'openclaw.json'),
    path.join(os.homedir(), '.config', 'openclaw', 'openclaw.json'),
  ];

  for (const configPath of configPaths) {
    try {
      if (!fs.existsSync(configPath)) continue;
      const raw = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(raw);

      const port = config.gateway?.port ?? 18789;
      const host = config.gateway?.host ?? '127.0.0.1';
      const baseUrl = `http://${host}:${port}`;

      // Try to find the token from agent configs or gateway config
      const token = config.gateway?.token ?? config.auth?.token ?? '';

      return { baseUrl, token };
    } catch {
      continue;
    }
  }

  // Try CLI detection
  try {
    const which = execSync('which openclaw 2>/dev/null', { encoding: 'utf-8' }).trim();
    if (which) {
      return { baseUrl: 'http://127.0.0.1:18789', token: '' };
    }
  } catch {
    // not found
  }

  return null;
}

async function fetchAgents(baseUrl: string, token: string): Promise<string[]> {
  try {
    const res = await fetch(`${baseUrl}/api/agents`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.ok) {
      const data = await res.json() as any;
      return Array.isArray(data) ? data.map((a: any) => a.id ?? a.name ?? a) : [];
    }
  } catch {
    // silent
  }
  return [];
}
