import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'apps', 'api-nest'))) return dir;
    if (fs.existsSync(path.join(dir, 'packages', 'hearth-cli'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

export async function installDependencies(): Promise<void> {
  console.log('📦  Step 1/7: Installing dependencies');
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

  // Install plugin into OpenClaw if openclaw CLI is available
  try {
    const openclawBin = execSync('which openclaw', { encoding: 'utf8', timeout: 5000 }).trim();
    if (openclawBin) {
      console.log('  → Installing Hearth plugin into OpenClaw...');
      try {
        execSync(`openclaw plugins install "${pluginDir}"`, { stdio: 'pipe', timeout: 30000 });
        console.log('  ✓ Hearth plugin installed in OpenClaw');
      } catch {
        console.log('  ⚠ Plugin install into OpenClaw failed — you may need to run manually:');
        console.log(`    openclaw plugins install ${pluginDir}`);
      }
    }
  } catch {
    // openclaw not found yet — will be handled in openclaw setup step
  }

  console.log('');
}

export async function installPlugin(): Promise<void> {
  const root = findProjectRoot();
  const pluginDir = path.join(root, 'packages', 'openclaw-plugin-hearth-app');

  try {
    const openclawBin = execSync('which openclaw', { encoding: 'utf8', timeout: 5000 }).trim();
    if (!openclawBin) return;

    // Check if already installed
    try {
      const plugins = execSync('openclaw plugins list 2>/dev/null', { encoding: 'utf8', timeout: 10000 });
      if (plugins.includes('hearth-app')) {
        console.log('  ✓ Hearth plugin already installed in OpenClaw');
        return;
      }
    } catch {
      // plugins list failed — try installing anyway
    }

    console.log('  🔌 Installing Hearth plugin into OpenClaw...');
    execSync(`openclaw plugins install "${pluginDir}"`, { stdio: 'pipe', timeout: 30000 });
    console.log('  ✓ Hearth plugin installed');

    // Restart gateway to load the plugin
    try {
      execSync('openclaw gateway restart', { stdio: 'pipe', timeout: 15000 });
      console.log('  ✓ OpenClaw gateway restarted');
    } catch {
      console.log('  ⚠ Could not restart gateway — restart OpenClaw manually to load the plugin');
    }
  } catch {
    console.log('  ⚠ OpenClaw not found — install the plugin manually after installing OpenClaw:');
    console.log(`    openclaw plugins install ${pluginDir}`);
  }
  console.log('');
}

export async function installRecommendedSkills(): Promise<void> {
  console.log('📚  Installing recommended skills');
  console.log('');

  try {
    const openclawBin = execSync('which openclaw', { encoding: 'utf8', timeout: 5000 }).trim();
    if (!openclawBin) {
      console.log('  ⚠ OpenClaw not found — skip skill installation');
      console.log('');
      return;
    }

    const skills = [
      { name: 'self-improvement', desc: 'learns from mistakes over time', pkg: 'clawhub install self-improving-agent' },
      { name: 'weather', desc: 'weather forecasts', pkg: 'clawhub install weather' },
    ];

    for (const skill of skills) {
      try {
        // Check if already installed
        const list = execSync('openclaw skills list 2>/dev/null', { encoding: 'utf8', timeout: 10000 });
        if (list.includes(skill.name)) {
          console.log(`  ✓ ${skill.name} — already installed`);
          continue;
        }
      } catch {
        // skills list failed — try installing anyway
      }

      console.log(`  → ${skill.name} — ${skill.desc}...`);
      try {
        execSync(skill.pkg, { stdio: 'pipe', timeout: 30000 });
        console.log(`  ✓ ${skill.name} installed`);
      } catch {
        console.log(`  ⚠ ${skill.name} — install failed (install manually later: ${skill.pkg})`);
      }
    }
  } catch {
    console.log('  ⚠ Could not install skills — install manually later');
  }

  console.log('');
}

export async function buildWebApp(): Promise<void> {
  console.log('🔨  Step 7/7: Building web app');
  console.log('');

  const root = findProjectRoot();
  const webDir = path.join(root, 'apps', 'web');
  const distDir = path.join(webDir, 'dist', 'pwa');

  if (fs.existsSync(distDir)) {
    console.log('  ✓ Web app already built');
    console.log('');
    return;
  }

  console.log('  → Building PWA...');
  try {
    execSync('npm run build:pwa', { cwd: webDir, stdio: 'pipe', timeout: 120000 });
    console.log('  ✓ Web app built');
  } catch {
    console.error('  ✗ Web app build failed');
    console.log('  You can build manually: cd apps/web && npm run build:pwa');
  }

  console.log('');
}
