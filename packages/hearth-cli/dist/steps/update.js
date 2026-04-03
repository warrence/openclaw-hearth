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
exports.runUpdate = runUpdate;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function run(cmd, cwd, timeoutMs = 180000) {
    try {
        return (0, child_process_1.execSync)(cmd, { cwd, stdio: 'pipe', timeout: timeoutMs }).toString().trim();
    }
    catch (err) {
        // If the command produced stdout and exited with code 0-equivalent, treat warnings as OK
        const stdout = err.stdout?.toString()?.trim() ?? '';
        const stderr = err.stderr?.toString()?.trim() ?? '';
        // Timeout
        if (err.killed || err.signal === 'SIGTERM') {
            throw new Error('Build timed out. Try adding swap: sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile');
        }
        // Real error
        const msg = stderr.split('\n')[0] || err.message?.split('\n')[0] || 'Command failed';
        throw new Error(msg);
    }
}
function getOpenClawVersion() {
    try {
        const output = (0, child_process_1.execSync)('openclaw --version', { stdio: 'pipe', timeout: 5000 }).toString().trim();
        // "OpenClaw 2026.4.2 (d74a122) — ..."
        const match = output.match(/OpenClaw\s+([\d.]+[-\w]*)/i);
        return match?.[1] ?? null;
    }
    catch {
        return null;
    }
}
function readCompatibility(root) {
    try {
        const p = path.join(root, 'compatibility.json');
        if (fs.existsSync(p)) {
            return JSON.parse(fs.readFileSync(p, 'utf-8'));
        }
    }
    catch { /* ignore */ }
    return {};
}
function compareVersions(a, b) {
    const pa = a.replace(/[^\d.]/g, '').split('.').map(Number);
    const pb = b.replace(/[^\d.]/g, '').split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0)
            return diff;
    }
    return 0;
}
async function runUpdate() {
    console.log('');
    console.log('🏠  Hearth Update');
    console.log('');
    const root = findProjectRoot();
    // 1. Get current version
    const pkgPath = path.join(root, 'package.json');
    const currentVersion = fs.existsSync(pkgPath)
        ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version ?? 'unknown'
        : 'unknown';
    // 2. Pull latest
    console.log('  → Pulling latest changes...');
    try {
        const pullOutput = run('git pull', root);
        if (pullOutput.includes('Already up to date')) {
            console.log('  ✓ Already up to date (v' + currentVersion + ')');
            console.log('');
            return;
        }
        console.log('  ✓ Pulled latest');
    }
    catch (err) {
        console.error('  ✗ Git pull failed:', err.message);
        process.exit(1);
    }
    // 3. Read new version
    const newVersion = fs.existsSync(pkgPath)
        ? JSON.parse(fs.readFileSync(pkgPath, 'utf-8')).version ?? 'unknown'
        : 'unknown';
    console.log(`  → Updating: v${currentVersion} → v${newVersion}`);
    // 4. Check OpenClaw compatibility
    const compat = readCompatibility(root);
    const openclawVersion = getOpenClawVersion();
    if (openclawVersion && compat.openclaw?.min) {
        if (compareVersions(openclawVersion, compat.openclaw.min) < 0) {
            console.error('');
            console.error(`  ⛔ OpenClaw ${openclawVersion} is below minimum required ${compat.openclaw.min}`);
            console.error(`     Please update OpenClaw first: npm install -g openclaw@latest`);
            console.error('');
            process.exit(1);
        }
        if (compat.openclaw.recommended && compareVersions(openclawVersion, compat.openclaw.recommended) < 0) {
            console.warn(`  ⚠ OpenClaw ${openclawVersion} works but ${compat.openclaw.recommended}+ is recommended`);
        }
        else {
            console.log(`  ✓ OpenClaw ${openclawVersion} compatible`);
        }
    }
    else if (openclawVersion) {
        console.log(`  ✓ OpenClaw ${openclawVersion}`);
    }
    else {
        console.warn('  ⚠ Could not detect OpenClaw version');
    }
    // 5. Install dependencies
    const packages = [
        { name: 'API', dir: path.join(root, 'apps', 'api-nest') },
        { name: 'Web', dir: path.join(root, 'apps', 'web') },
        { name: 'Plugin', dir: path.join(root, 'packages', 'openclaw-plugin-hearth-app') },
    ];
    console.log('  → Installing dependencies...');
    for (const pkg of packages) {
        if (!fs.existsSync(path.join(pkg.dir, 'package.json')))
            continue;
        try {
            run('npm install --prefer-offline', pkg.dir);
        }
        catch {
            try {
                run('npm install', pkg.dir);
            }
            catch (err) {
                console.error(`  ✗ ${pkg.name}: npm install failed — ${err.message}`);
                if (err.message.includes('ETIMEDOUT') || err.message.includes('ENOMEM') || err.message.includes('killed')) {
                    console.error('  💡 Low memory? Try adding swap: sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile');
                }
                process.exit(1);
            }
        }
    }
    console.log('  ✓ Dependencies installed');
    // 6. Verify pre-built dist (builds are shipped in git — no build step needed)
    const distChecks = [
        { name: 'API', file: path.join(root, 'apps', 'api-nest', 'dist', 'main.js') },
        { name: 'Web', file: path.join(root, 'apps', 'web', 'dist', 'pwa', 'index.html') },
        { name: 'Plugin', file: path.join(root, 'packages', 'openclaw-plugin-hearth-app', 'dist', 'index.js') },
    ];
    let allDistPresent = true;
    for (const check of distChecks) {
        if (!fs.existsSync(check.file)) {
            console.warn(`  ⚠ ${check.name} dist missing — rebuilding...`);
            allDistPresent = false;
        }
    }
    if (allDistPresent) {
        console.log('  ✓ Pre-built assets verified');
    }
    else {
        // Fallback: build locally if dist files are missing
        console.log('  → Building missing assets...');
        const buildTargets = [
            { name: 'API', dir: path.join(root, 'apps', 'api-nest'), cmd: 'npm run build', check: distChecks[0].file },
            { name: 'Plugin', dir: path.join(root, 'packages', 'openclaw-plugin-hearth-app'), cmd: 'npm run build', check: distChecks[2].file },
            { name: 'Web', dir: path.join(root, 'apps', 'web'), cmd: 'npm run build:pwa', check: distChecks[1].file },
        ];
        for (const target of buildTargets) {
            if (fs.existsSync(target.check))
                continue; // already built
            try {
                console.log(`    → ${target.name}...`);
                (0, child_process_1.execSync)(target.cmd, {
                    cwd: target.dir,
                    stdio: 'inherit',
                    timeout: 600000,
                    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=1024' },
                });
                console.log(`    ✓ ${target.name}`);
            }
            catch (err) {
                console.error(`  ✗ ${target.name} build failed`);
                if (err.killed) {
                    console.error('  💡 Try adding swap: sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile');
                }
                process.exit(1);
            }
        }
        console.log('  ✓ Build complete');
    }
    // 7. Run migrations if available
    try {
        const apiDir = path.join(root, 'apps', 'api-nest');
        const migrationsDir = path.join(apiDir, 'src', 'database', 'migrations');
        if (fs.existsSync(migrationsDir)) {
            console.log('  → Running database migrations...');
            run('node dist/main.js --run-migrations', apiDir, 30000);
            console.log('  ✓ Migrations complete');
        }
    }
    catch {
        // Migrations might not be implemented yet — skip silently
    }
    // 8. Reinstall OpenClaw plugin
    try {
        const pluginDir = path.join(root, 'packages', 'openclaw-plugin-hearth-app');
        if (fs.existsSync(pluginDir)) {
            console.log('  → Updating OpenClaw plugin...');
            run(`openclaw plugins install ${pluginDir}`, root, 30000);
            console.log('  ✓ Plugin updated');
        }
    }
    catch {
        console.warn('  ⚠ Plugin update skipped (openclaw not found or plugin install failed)');
    }
    console.log('');
    console.log(`  ✅ Updated to v${newVersion}`);
    console.log('');
    console.log('  Restart Hearth to apply changes:');
    console.log('    npx hearth start');
    console.log('');
}
