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
exports.runStart = runStart;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function findOpenClawBin() {
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
async function runStart(opts) {
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
    // Start PostgreSQL if not running
    try {
        (0, child_process_1.execSync)('pg_isready -q', { timeout: 3000 });
        console.log('  ✓ PostgreSQL running');
    }
    catch {
        console.log('  → Starting PostgreSQL...');
        try {
            // Find installed version
            const pgVersions = fs.readdirSync('/etc/postgresql').filter(v => /^\d+$/.test(v));
            if (pgVersions.length > 0) {
                const ver = pgVersions.sort().reverse()[0];
                (0, child_process_1.execSync)(`pg_ctlcluster ${ver} main start`, { stdio: 'pipe', timeout: 10000 });
                console.log(`  ✓ PostgreSQL ${ver} started`);
            }
            else {
                // Try systemctl
                (0, child_process_1.execSync)('sudo systemctl start postgresql 2>/dev/null || systemctl start postgresql 2>/dev/null', { stdio: 'pipe', timeout: 10000 });
                console.log('  ✓ PostgreSQL started');
            }
        }
        catch {
            console.log('  ⚠ Could not start PostgreSQL — start it manually');
        }
    }
    // Start OpenClaw gateway if not running
    try {
        const healthRes = await fetch(`http://127.0.0.1:18789/health`).catch(() => null);
        if (!healthRes?.ok) {
            console.log('  → Starting OpenClaw gateway...');
            // Try systemd first, fall back to foreground
            try {
                const { execSync } = require('child_process');
                execSync('openclaw gateway start 2>/dev/null', { timeout: 5000 });
            }
            catch {
                // No systemd — run in foreground (background process)
                const openclawBin = findOpenClawBin();
                if (openclawBin) {
                    const gw = (0, child_process_1.spawn)(openclawBin, ['gateway'], {
                        stdio: ['ignore', 'pipe', 'pipe'],
                        detached: true,
                    });
                    gw.unref();
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                    const check = await fetch('http://127.0.0.1:18789/health').catch(() => null);
                    if (check?.ok) {
                        console.log('  ✓ OpenClaw gateway started');
                    }
                    else {
                        console.log('  ⚠ OpenClaw gateway may not be ready — check with: openclaw gateway status');
                    }
                }
                else {
                    console.log('  ⚠ OpenClaw not found — start it manually: openclaw gateway');
                }
            }
        }
        else {
            console.log('  ✓ OpenClaw gateway already running');
        }
    }
    catch {
        console.log('  ⚠ Could not check OpenClaw — start it manually if needed');
    }
    // Start API
    console.log(`  → API starting on port ${opts.apiPort}...`);
    const api = (0, child_process_1.spawn)('node', ['dist/main.js'], {
        cwd: apiDir,
        env: { ...process.env, PORT: opts.apiPort },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    api.stdout?.on('data', (data) => {
        const line = data.toString().trim();
        if (line.includes('successfully started')) {
            console.log(`  ✓ API running on port ${opts.apiPort}`);
        }
    });
    api.stderr?.on('data', (data) => {
        console.error(`  [API] ${data.toString().trim()}`);
    });
    // Wait for API to start
    await new Promise((resolve) => setTimeout(resolve, 3000));
    // Start web server
    if (fs.existsSync(pwaServer) && fs.existsSync(pwaDir)) {
        console.log(`  → Web server starting on port ${opts.port}...`);
        const web = (0, child_process_1.spawn)('node', ['scripts/pwa-prod-server.mjs'], {
            cwd: webDir,
            env: {
                ...process.env,
                PORT: opts.port,
                NEST_API_ORIGIN: `http://127.0.0.1:${opts.apiPort}`,
                API_ORIGIN: `http://127.0.0.1:${opts.apiPort}`,
            },
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        web.stdout?.on('data', (data) => {
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
    }
    else {
        // Fall back to Quasar dev server
        console.log(`  → Starting dev server on port 9000...`);
        const dev = (0, child_process_1.spawn)('npx', ['quasar', 'dev'], {
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
    await new Promise(() => { });
}
