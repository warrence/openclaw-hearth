import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'apps', 'api-nest'))) return dir;
    if (fs.existsSync(path.join(dir, 'packages', 'hearth-cli'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function findOpenClaw(): string | null {
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

export async function installDependencies(): Promise<void> {
  console.log('📦  Installing dependencies');
  console.log('');

  const root = findProjectRoot();
  const packages = [
    { name: 'API', dir: path.join(root, 'apps', 'api-nest') },
    { name: 'Web', dir: path.join(root, 'apps', 'web') },
    { name: 'Plugin', dir: path.join(root, 'packages', 'openclaw-plugin-hearth-app') },
  ];

  for (const pkg of packages) {
    if (!fs.existsSync(path.join(pkg.dir, 'package.json'))) {
      console.log(`  ⚠ ${pkg.name}: package.json not found, skipping`);
      continue;
    }

    const nodeModules = path.join(pkg.dir, 'node_modules');
    if (fs.existsSync(nodeModules)) {
      console.log(`  ✓ ${pkg.name}: dependencies already installed`);
      continue;
    }

    console.log(`  → ${pkg.name}: installing...`);
    try {
      execSync('npm install', { cwd: pkg.dir, stdio: 'pipe', timeout: 120000 });
      console.log(`  ✓ ${pkg.name}: done`);
    } catch (err: any) {
      console.error(`  ✗ ${pkg.name}: npm install failed`);
      console.error(`    ${err.message?.split('\n')[0] ?? 'Unknown error'}`);
      process.exit(1);
    }
  }

  // Build API if dist doesn't exist
  const apiDist = path.join(root, 'apps', 'api-nest', 'dist');
  if (!fs.existsSync(apiDist)) {
    console.log('  → API: building...');
    try {
      execSync('npm run build', { cwd: path.join(root, 'apps', 'api-nest'), stdio: 'pipe', timeout: 60000 });
      console.log('  ✓ API: built');
    } catch {
      console.error('  ✗ API build failed');
      process.exit(1);
    }
  }

  // Build plugin if dist doesn't exist
  const pluginDir = path.join(root, 'packages', 'openclaw-plugin-hearth-app');
  const pluginDist = path.join(pluginDir, 'dist');
  if (!fs.existsSync(pluginDist)) {
    console.log('  → Plugin: building...');
    try {
      execSync('npm run build', { cwd: pluginDir, stdio: 'pipe', timeout: 60000 });
      console.log('  ✓ Plugin: built');
    } catch {
      console.error('  ✗ Plugin build failed');
      process.exit(1);
    }
  }

  console.log('');
}

export async function installPlugin(): Promise<void> {
  const root = findProjectRoot();
  const pluginDir = path.join(root, 'packages', 'openclaw-plugin-hearth-app');
  const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');

  console.log('  🔌 Configuring Hearth plugin in OpenClaw...');

  // Generate a channel token
  const crypto = require('crypto');
  const channelToken = crypto.randomBytes(24).toString('hex');

  try {
    // Read or create openclaw.json
    const config: Record<string, any> = fs.existsSync(configPath)
      ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
      : {};

    // 1. Add plugin to load paths (this is how OpenClaw discovers plugins)
    if (!config.plugins) config.plugins = {};
    if (!config.plugins.load) config.plugins.load = {};
    if (!config.plugins.load.paths) config.plugins.load.paths = [];
    if (!config.plugins.load.paths.includes(pluginDir)) {
      config.plugins.load.paths.push(pluginDir);
    }

    // 2. Add channel config (this is where the plugin reads its settings)
    if (!config.channels) config.channels = {};
    config.channels['hearth-app'] = {
      enabled: true,
      token: channelToken,
      httpPath: '/channel/hearth-app/inbound',
    };

    // 3. Ensure gateway auth token exists
    if (!config.gateway) config.gateway = {};
    if (!config.gateway.auth) config.gateway.auth = {};
    if (!config.gateway.auth.token) {
      config.gateway.auth.mode = 'token';
      config.gateway.auth.token = crypto.randomBytes(24).toString('hex');
      console.log('  ✓ Gateway token generated');
    }

    // 4. Also create symlink in extensions (belt + suspenders)
    const extensionsDir = path.join(os.homedir(), '.openclaw', 'extensions');
    const extensionLink = path.join(extensionsDir, 'hearth-app');
    if (!fs.existsSync(extensionsDir)) {
      fs.mkdirSync(extensionsDir, { recursive: true });
    }
    try {
      if (fs.existsSync(extensionLink)) {
        fs.rmSync(extensionLink, { recursive: true, force: true });
      }
      fs.symlinkSync(pluginDir, extensionLink);
    } catch {
      // symlink failed — load.paths should still work
    }

    // Save config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('  ✓ Plugin configured in OpenClaw');
    console.log(`  ✓ Channel token: ${channelToken.slice(0, 8)}...`);

    // 5. Save channel token + gateway token to Hearth .env
    const envPath = path.join(root, 'apps', 'api-nest', '.env');
    if (fs.existsSync(envPath)) {
      let env = fs.readFileSync(envPath, 'utf-8');

      // Update or add OPENCLAW_HEARTH_CHANNEL_TOKEN
      if (env.includes('OPENCLAW_HEARTH_CHANNEL_TOKEN=')) {
        env = env.replace(/OPENCLAW_HEARTH_CHANNEL_TOKEN=.*/g, `OPENCLAW_HEARTH_CHANNEL_TOKEN=${channelToken}`);
      } else {
        env += `\nOPENCLAW_HEARTH_CHANNEL_TOKEN=${channelToken}`;
      }

      // Update or add OPENCLAW_GATEWAY_TOKEN
      const gatewayToken = config.gateway.auth.token;
      if (env.includes('OPENCLAW_GATEWAY_TOKEN=')) {
        env = env.replace(/OPENCLAW_GATEWAY_TOKEN=.*/g, `OPENCLAW_GATEWAY_TOKEN=${gatewayToken}`);
      } else {
        env += `\nOPENCLAW_GATEWAY_TOKEN=${gatewayToken}`;
      }

      fs.writeFileSync(envPath, env);
      console.log('  ✓ Tokens saved to .env');
    }

  } catch (err: any) {
    console.log(`  ⚠ Plugin configuration failed: ${err.message}`);
    console.log('  Manual fix: see docs/enhance-your-assistant.md');
  }

  console.log('');
}

export async function buildWebApp(): Promise<void> {
  console.log('🔨  Building web app');
  console.log('');

  const root = findProjectRoot();
  const webDir = path.join(root, 'apps', 'web');
  const distDir = path.join(webDir, 'dist', 'pwa');

  if (fs.existsSync(distDir)) {
    console.log('  ✓ Web app already built');
    console.log('');
    return;
  }

  console.log('  → Building PWA (this may take a minute)...');
  try {
    execSync('npm run build:pwa', { cwd: webDir, stdio: 'pipe', timeout: 120000 });
    console.log('  ✓ Web app built');
  } catch {
    console.error('  ✗ Web app build failed');
    console.log('  You can build manually: cd apps/web && npm run build:pwa');
  }

  console.log('');
}
