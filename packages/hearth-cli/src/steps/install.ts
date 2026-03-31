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
  const pluginDist = path.join(root, 'packages', 'openclaw-plugin-hearth-app', 'dist');
  if (!fs.existsSync(pluginDist)) {
    console.log('  → Plugin: building...');
    try {
      execSync('npm run build', { cwd: path.join(root, 'packages', 'openclaw-plugin-hearth-app'), stdio: 'pipe', timeout: 60000 });
      console.log('  ✓ Plugin: built');
    } catch {
      console.error('  ✗ Plugin build failed');
      process.exit(1);
    }
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
