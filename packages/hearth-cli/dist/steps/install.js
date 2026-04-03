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
exports.installDependencies = installDependencies;
exports.installPlugin = installPlugin;
exports.buildWebApp = buildWebApp;
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
function findOpenClaw() {
    try {
        return (0, child_process_1.execSync)('which openclaw', { encoding: 'utf8', timeout: 5000 }).trim() || null;
    }
    catch { /* not in PATH */ }
    const nvmDir = process.env.NVM_DIR || path.join(os.homedir(), '.nvm');
    try {
        const nodeVersion = (0, child_process_1.execSync)('node -v', { encoding: 'utf8', timeout: 5000 }).trim();
        const bin = path.join(nvmDir, 'versions', 'node', nodeVersion, 'bin', 'openclaw');
        if (fs.existsSync(bin))
            return bin;
    }
    catch { /* ignore */ }
    try {
        const prefix = (0, child_process_1.execSync)('npm prefix -g', { encoding: 'utf8', timeout: 5000 }).trim();
        const bin = path.join(prefix, 'bin', 'openclaw');
        if (fs.existsSync(bin))
            return bin;
    }
    catch { /* ignore */ }
    return null;
}
async function installDependencies() {
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
            (0, child_process_1.execSync)('npm install', { cwd: pkg.dir, stdio: 'pipe', timeout: 120000 });
            console.log(`  ✓ ${pkg.name}: done`);
        }
        catch (err) {
            const msg = err.message?.split('\n')[0] ?? 'Unknown error';
            console.error(`  ✗ ${pkg.name}: npm install failed`);
            console.error(`    ${msg}`);
            if (msg.includes('ETIMEDOUT') || msg.includes('ENOMEM') || msg.includes('killed')) {
                console.error('');
                console.error('  💡 This might be a memory issue. If you\'re on a small server (< 2GB RAM),');
                console.error('     try adding swap space:');
                console.error('');
                console.error('     sudo fallocate -l 1G /swapfile');
                console.error('     sudo chmod 600 /swapfile');
                console.error('     sudo mkswap /swapfile');
                console.error('     sudo swapon /swapfile');
                console.error('');
                console.error('     Then re-run: npx hearth setup');
            }
            process.exit(1);
        }
    }
    // Build API if dist doesn't exist
    const apiDist = path.join(root, 'apps', 'api-nest', 'dist');
    if (!fs.existsSync(apiDist)) {
        console.log('  → API: building...');
        try {
            (0, child_process_1.execSync)('npm run build', { cwd: path.join(root, 'apps', 'api-nest'), stdio: 'pipe', timeout: 60000 });
            console.log('  ✓ API: built');
        }
        catch {
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
            (0, child_process_1.execSync)('npm run build', { cwd: pluginDir, stdio: 'pipe', timeout: 60000 });
            console.log('  ✓ Plugin: built');
        }
        catch {
            console.error('  ✗ Plugin build failed');
            process.exit(1);
        }
    }
    console.log('');
}
async function installPlugin() {
    const root = findProjectRoot();
    const pluginDir = path.join(root, 'packages', 'openclaw-plugin-hearth-app');
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    console.log('  🔌 Configuring Hearth plugin in OpenClaw...');
    // Generate a channel token
    const crypto = require('crypto');
    const channelToken = crypto.randomBytes(24).toString('hex');
    try {
        // Read or create openclaw.json
        const config = fs.existsSync(configPath)
            ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            : {};
        // 1. Add plugin to load paths (this is how OpenClaw discovers plugins)
        if (!config.plugins)
            config.plugins = {};
        if (!config.plugins.load)
            config.plugins.load = {};
        if (!config.plugins.load.paths)
            config.plugins.load.paths = [];
        if (!config.plugins.load.paths.includes(pluginDir)) {
            config.plugins.load.paths.push(pluginDir);
        }
        // 2. Add plugins.entries with token (required by OpenClaw 2026.4.1+)
        if (!config.plugins.entries)
            config.plugins.entries = {};
        config.plugins.entries['hearth-app'] = {
            enabled: true,
            config: {
                token: channelToken,
            },
        };
        // 3. Add channel config (this is where the plugin reads its settings)
        if (!config.channels)
            config.channels = {};
        config.channels['hearth-app'] = {
            enabled: true,
            token: channelToken,
            httpPath: '/channel/hearth-app/inbound',
        };
        // 3. Ensure gateway auth token exists
        if (!config.gateway)
            config.gateway = {};
        if (!config.gateway.auth)
            config.gateway.auth = {};
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
        }
        catch {
            // symlink failed — load.paths should still work
        }
        // Save config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('  ✓ Plugin configured in OpenClaw');
        console.log(`  ✓ Channel token: ${channelToken.slice(0, 8)}...`);
        const gatewayToken = config.gateway.auth.token;
        console.log('');
        return { channelToken, gatewayToken };
    }
    catch (err) {
        console.log(`  ⚠ Plugin configuration failed: ${err.message}`);
        console.log('  Manual fix: see docs/enhance-your-assistant.md');
    }
    console.log('');
    return { channelToken: '', gatewayToken: '' };
}
async function buildWebApp() {
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
        (0, child_process_1.execSync)('npm run build:pwa', { cwd: webDir, stdio: 'pipe', timeout: 120000 });
        console.log('  ✓ Web app built');
    }
    catch {
        console.error('  ✗ Web app build failed');
        console.log('  You can build manually: cd apps/web && npm run build:pwa');
    }
    console.log('');
}
