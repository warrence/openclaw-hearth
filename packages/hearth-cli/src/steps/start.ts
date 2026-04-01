import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function findOpenClawBin(): string | null {
  try {
    return execSync('which openclaw', { encoding: 'utf8', timeout: 5000 }).trim() || null;
  } catch { /* not in PATH */ }

  const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
  try {
    const nodeVersion = execSync('node -v', { encoding: 'utf8', timeout: 5000 }).trim();
    const bin = path.join(nvmDir, 'versions', 'node', nodeVersion, 'bin', 'openclaw');
    if (fs.existsSync(bin)) return bin;
  } catch { /* ignore */ }

  try {
    const prefix = execSync('npm prefix -g', { encoding: 'utf8', timeout: 5000 }).trim();
    const bin = path.join(prefix, 'bin', 'openclaw');
    if (fs.existsSync(bin)) return bin;
  } catch { /* ignore */ }

  return null;
}

function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'apps', 'api-nest'))) return dir;
    if (fs.existsSync(path.join(dir, 'packages', 'hearth-cli'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export async function runStart(opts: { port: string; apiPort: string }): Promise<void> {
  const root = findProjectRoot();
  const apiDir = path.join(root, 'apps', 'api-nest');
  const webDir = path.join(root, 'apps', 'web');
  const envFile = path.join(apiDir, '.env');
  const pwaDir = path.join(webDir, 'dist', 'pwa');
  const pwaServer = path.join(webDir, 'scripts', 'pwa-prod-server.mjs');

  // Preflight checks
  if (!fs.existsSync(envFile)) {
    console.error('❌ No .env file found. Run "npx hearth setup" first.');
    process.exit(1);
  }

  if (!fs.existsSync(path.join(apiDir, 'dist', 'main.js'))) {
    console.error('❌ API not built. Run "npx hearth setup" first.');
    process.exit(1);
  }

  console.log('');
  console.log('🏠  Starting Hearth');
  console.log('─'.repeat(40));

  // Start OpenClaw gateway if not running
  try {
    const healthRes = await fetch(`http://127.0.0.1:18789/health`).catch(() => null);
    if (!healthRes?.ok) {
      console.log('  → Starting OpenClaw gateway...');
      // Try systemd first, fall back to foreground
      try {
        const { execSync } = require('child_process');
        execSync('openclaw gateway start 2>/dev/null', { timeout: 5000 });
      } catch {
        // No systemd — run in foreground (background process)
        const openclawBin = findOpenClawBin();
        if (openclawBin) {
          const gw = spawn(openclawBin, ['gateway'], {
            stdio: ['ignore', 'pipe', 'pipe'],
            detached: true,
          });
          gw.unref();
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const check = await fetch('http://127.0.0.1:18789/health').catch(() => null);
          if (check?.ok) {
            console.log('  ✓ OpenClaw gateway started');
          } else {
            console.log('  ⚠ OpenClaw gateway may not be ready — check with: openclaw gateway status');
          }
        } else {
          console.log('  ⚠ OpenClaw not found — start it manually: openclaw gateway');
        }
      }
    } else {
      console.log('  ✓ OpenClaw gateway already running');
    }
  } catch {
    console.log('  ⚠ Could not check OpenClaw — start it manually if needed');
  }

  // Start API
  console.log(`  → API starting on port ${opts.apiPort}...`);
  const api = spawn('node', ['dist/main.js'], {
    cwd: apiDir,
    env: { ...process.env, PORT: opts.apiPort },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  api.stdout?.on('data', (data: Buffer) => {
    const line = data.toString().trim();
    if (line.includes('successfully started')) {
      console.log(`  ✓ API running on port ${opts.apiPort}`);
    }
  });

  api.stderr?.on('data', (data: Buffer) => {
    console.error(`  [API] ${data.toString().trim()}`);
  });

  // Wait for API to start
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Start web server
  if (fs.existsSync(pwaServer) && fs.existsSync(pwaDir)) {
    console.log(`  → Web server starting on port ${opts.port}...`);
    const web = spawn('node', ['scripts/pwa-prod-server.mjs'], {
      cwd: webDir,
      env: {
        ...process.env,
        PORT: opts.port,
        NEST_API_ORIGIN: `http://127.0.0.1:${opts.apiPort}`,
        API_ORIGIN: `http://127.0.0.1:${opts.apiPort}`,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    web.stdout?.on('data', (data: Buffer) => {
      const line = data.toString().trim();
      if (line.includes('listening')) {
        console.log(`  ✓ Web server running on port ${opts.port}`);
        console.log('');
        console.log('━'.repeat(40));
        console.log(`  🏠  Hearth is running!`);
        console.log(`  Open: http://localhost:${opts.port}`);
        console.log('━'.repeat(40));
        console.log('');
        console.log('  Press Ctrl+C to stop');
      }
    });

    web.on('exit', (code) => {
      console.log(`  Web server exited (code ${code})`);
      api.kill();
      process.exit(code ?? 1);
    });
  } else {
    // Fall back to Quasar dev server
    console.log(`  → Starting dev server on port 9000...`);
    const dev = spawn('npx', ['quasar', 'dev'], {
      cwd: webDir,
      env: {
        ...process.env,
        VITE_NEST_API_BASE_URL: `/nest-api`,
        VITE_NEST_READS_ENABLED: 'true',
        VITE_NEST_READS_STRICT: 'true',
        VITE_NEST_CONVERSATION_CREATE_ENABLED: 'true',
        VITE_NEST_CONVERSATION_WRITES_ENABLED: 'true',
      },
      stdio: 'inherit',
    });

    dev.on('exit', (code) => {
      api.kill();
      process.exit(code ?? 1);
    });
  }

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n  Stopping Hearth...');
    api.kill();
    process.exit(0);
  });

  // Keep process alive
  await new Promise(() => {});
}
