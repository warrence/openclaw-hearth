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

function detectNodePath(): string {
  try {
    return execSync('which node', { stdio: 'pipe', timeout: 3000 }).toString().trim();
  } catch {
    return '/usr/bin/node';
  }
}

function detectNpmPath(): string {
  try {
    return execSync('which npm', { stdio: 'pipe', timeout: 3000 }).toString().trim();
  } catch {
    return '/usr/bin/npm';
  }
}

// ─── systemd (Linux) ───

function createSystemdService(root: string): void {
  const user = os.userInfo().username;
  const nodePath = detectNodePath();
  const nodeDir = path.dirname(nodePath);

  const serviceContent = `[Unit]
Description=Hearth — Household Assistant
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=${user}
WorkingDirectory=${root}
ExecStart=${nodePath} ${path.join(root, 'packages', 'hearth-cli', 'dist', 'index.js')} start
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PATH=${nodeDir}:/usr/local/bin:/usr/bin:/bin
${process.env.NVM_DIR ? `Environment=NVM_DIR=${process.env.NVM_DIR}` : ''}

[Install]
WantedBy=multi-user.target
`;

  const servicePath = '/etc/systemd/system/hearth.service';

  try {
    fs.writeFileSync(servicePath, serviceContent);
    console.log(`  ✓ Service file written: ${servicePath}`);
  } catch {
    // Try with sudo
    try {
      execSync(`sudo tee ${servicePath} > /dev/null`, {
        input: serviceContent,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      });
      console.log(`  ✓ Service file written: ${servicePath}`);
    } catch {
      console.error(`  ✗ Could not write ${servicePath}`);
      console.error('    Try running with sudo: sudo npx hearth install-service');
      process.exit(1);
    }
  }

  try {
    execSync('sudo systemctl daemon-reload', { stdio: 'pipe', timeout: 10000 });
    execSync('sudo systemctl enable hearth', { stdio: 'pipe', timeout: 10000 });
    console.log('  ✓ Service enabled (auto-start on boot)');
  } catch {
    console.warn('  ⚠ Could not enable service — run: sudo systemctl enable hearth');
  }

  console.log('');
  console.log('  Commands:');
  console.log('    sudo systemctl start hearth     # Start');
  console.log('    sudo systemctl stop hearth      # Stop');
  console.log('    sudo systemctl restart hearth   # Restart');
  console.log('    sudo systemctl status hearth    # Status');
  console.log('    journalctl -u hearth -f         # View logs');
}

// ─── launchd (macOS) ───

function createLaunchdService(root: string): void {
  const nodePath = detectNodePath();
  const label = 'ai.hearth.app';
  const plistDir = path.join(os.homedir(), 'Library', 'LaunchAgents');
  const plistPath = path.join(plistDir, `${label}.plist`);
  const logPath = path.join(os.homedir(), 'Library', 'Logs', 'hearth.log');
  const errPath = path.join(os.homedir(), 'Library', 'Logs', 'hearth-error.log');

  const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${label}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${nodePath}</string>
    <string>${path.join(root, 'packages', 'hearth-cli', 'dist', 'index.js')}</string>
    <string>start</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${root}</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${logPath}</string>
  <key>StandardErrorPath</key>
  <string>${errPath}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key>
    <string>production</string>
    <key>PATH</key>
    <string>${path.dirname(nodePath)}:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
`;

  if (!fs.existsSync(plistDir)) {
    fs.mkdirSync(plistDir, { recursive: true });
  }

  fs.writeFileSync(plistPath, plistContent);
  console.log(`  ✓ Plist written: ${plistPath}`);

  try {
    // Unload if already loaded
    try {
      execSync(`launchctl bootout gui/$(id -u) ${plistPath} 2>/dev/null`, { stdio: 'pipe', timeout: 5000 });
    } catch { /* ignore */ }

    execSync(`launchctl bootstrap gui/$(id -u) ${plistPath}`, { stdio: 'pipe', timeout: 5000 });
    console.log('  ✓ Service loaded (auto-start on login)');
  } catch {
    console.warn('  ⚠ Could not load service — run: launchctl load ' + plistPath);
  }

  console.log('');
  console.log('  Commands:');
  console.log(`    launchctl kickstart -k gui/$(id -u)/${label}   # Restart`);
  console.log(`    launchctl kill SIGTERM gui/$(id -u)/${label}    # Stop`);
  console.log(`    tail -f ${logPath}                              # View logs`);
}

// ─── Main ───

export async function runInstallService(): Promise<void> {
  console.log('');
  console.log('🔧  Install Hearth as a background service');
  console.log('');

  const root = findProjectRoot();
  const platform = os.platform();

  // Verify dist exists
  const apiDist = path.join(root, 'apps', 'api-nest', 'dist', 'main.js');
  const webDist = path.join(root, 'apps', 'web', 'dist', 'pwa', 'index.html');
  if (!fs.existsSync(apiDist) || !fs.existsSync(webDist)) {
    console.error('  ✗ Build artifacts missing. Run the build first:');
    console.error('    cd apps/api-nest && npm run build');
    console.error('    cd apps/web && npx quasar build -m pwa');
    process.exit(1);
  }

  if (platform === 'linux') {
    // Check for systemd
    try {
      execSync('systemctl --version', { stdio: 'pipe', timeout: 3000 });
      console.log('  → Detected: Linux with systemd');
      console.log('');
      createSystemdService(root);
    } catch {
      console.error('  ✗ systemd not found. Use pm2 instead:');
      console.error('    npm install -g pm2');
      console.error('    pm2 start "npx hearth start" --name hearth');
      console.error('    pm2 save && pm2 startup');
      process.exit(1);
    }
  } else if (platform === 'darwin') {
    console.log('  → Detected: macOS');
    console.log('');
    createLaunchdService(root);
  } else {
    console.error(`  ✗ Unsupported platform: ${platform}`);
    console.error('  Use pm2 instead:');
    console.error('    npm install -g pm2');
    console.error('    pm2 start "npx hearth start" --name hearth');
    console.error('    pm2 save && pm2 startup');
    process.exit(1);
  }

  console.log('');
  console.log('  ✅ Hearth installed as a background service');
  console.log('');
}
