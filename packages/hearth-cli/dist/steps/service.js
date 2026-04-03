"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runInstallService = runInstallService;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function findProjectRoot() {
    let dir = process.cwd();
    for (let i = 0; i < 10; i++) {
        if (fs.existsSync(path.join(dir, 'apps', 'api-nest')))
            return dir;
        if (fs.existsSync(path.join(dir, 'packages', 'hearth-cli')))
            return dir;
        dir = path.dirname(dir);
    }
    return process.cwd();
}
function detectNodePath() {
    try {
        return (0, child_process_1.execSync)('which node', { stdio: 'pipe', timeout: 3000 }).toString().trim();
    }
    catch {
        return '/usr/bin/node';
    }
}
function detectNpmPath() {
    try {
        return (0, child_process_1.execSync)('which npm', { stdio: 'pipe', timeout: 3000 }).toString().trim();
    }
    catch {
        return '/usr/bin/npm';
    }
}
// ─── systemd (Linux) ───
function createSystemdService(root) {
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
    }
    catch {
        // Try with sudo
        try {
            (0, child_process_1.execSync)(`sudo tee ${servicePath} > /dev/null`, {
                input: serviceContent,
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 5000,
            });
            console.log(`  ✓ Service file written: ${servicePath}`);
        }
        catch {
            console.error(`  ✗ Could not write ${servicePath}`);
            console.error('    Try running with sudo: sudo npx hearth install-service');
            process.exit(1);
        }
    }
    try {
        (0, child_process_1.execSync)('sudo systemctl daemon-reload', { stdio: 'pipe', timeout: 10000 });
        (0, child_process_1.execSync)('sudo systemctl enable hearth', { stdio: 'pipe', timeout: 10000 });
        console.log('  ✓ Service enabled (auto-start on boot)');
    }
    catch {
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
function createLaunchdService(root) {
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
            (0, child_process_1.execSync)(`launchctl bootout gui/$(id -u) ${plistPath} 2>/dev/null`, { stdio: 'pipe', timeout: 5000 });
        }
        catch { /* ignore */ }
        (0, child_process_1.execSync)(`launchctl bootstrap gui/$(id -u) ${plistPath}`, { stdio: 'pipe', timeout: 5000 });
        console.log('  ✓ Service loaded (auto-start on login)');
    }
    catch {
        console.warn('  ⚠ Could not load service — run: launchctl load ' + plistPath);
    }
    console.log('');
    console.log('  Commands:');
    console.log(`    launchctl kickstart -k gui/$(id -u)/${label}   # Restart`);
    console.log(`    launchctl kill SIGTERM gui/$(id -u)/${label}    # Stop`);
    console.log(`    tail -f ${logPath}                              # View logs`);
}
// ─── Main ───
async function runInstallService() {
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
            (0, child_process_1.execSync)('systemctl --version', { stdio: 'pipe', timeout: 3000 });
            console.log('  → Detected: Linux with systemd');
            console.log('');
            createSystemdService(root);
        }
        catch {
            console.error('  ✗ systemd not found. Use pm2 instead:');
            console.error('    npm install -g pm2');
            console.error('    pm2 start "npx hearth start" --name hearth');
            console.error('    pm2 save && pm2 startup');
            process.exit(1);
        }
    }
    else if (platform === 'darwin') {
        console.log('  → Detected: macOS');
        console.log('');
        createLaunchdService(root);
    }
    else {
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
