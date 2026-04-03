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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupOpenClaw = setupOpenClaw;
const inquirer_1 = __importDefault(require("inquirer"));
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
async function setupOpenClaw() {
    console.log('🔗  Step 2/4: OpenClaw');
    console.log('');
    // Try to auto-detect OpenClaw
    const detected = detectOpenClaw();
    if (detected) {
        console.log(`  ✓ Found OpenClaw at ${detected.baseUrl}`);
        if (detected.token) {
            console.log('  ✓ Token auto-detected');
        }
        const { useDetected } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'useDetected',
                message: 'Use detected OpenClaw configuration?',
                default: true,
            },
        ]);
        if (useDetected) {
            ensureResponsesEndpoint();
            const agents = await fetchAgents(detected.baseUrl, detected.token);
            console.log('  ✓ OpenClaw configured');
            console.log('');
            return { ...detected, agents };
        }
    }
    // Ask user if they have OpenClaw installed
    const { hasOpenClaw } = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'hasOpenClaw',
            message: 'Do you have OpenClaw installed?',
            default: false,
        },
    ]);
    if (!hasOpenClaw) {
        const { installNow } = await inquirer_1.default.prompt([
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
                (0, child_process_1.execSync)('npm install -g openclaw', { stdio: 'inherit' });
                console.log('  ✓ OpenClaw installed');
            }
            catch {
                console.error('  ✗ Installation failed. Please install OpenClaw manually:');
                console.log('    npm install -g openclaw');
                process.exit(1);
            }
            // Run openclaw setup — this handles model selection, provider auth (OAuth), API keys
            console.log('');
            console.log('  → Running OpenClaw setup...');
            console.log('  This will configure your AI model and provider authentication.');
            console.log('  Follow the prompts from OpenClaw:');
            console.log('');
            try {
                (0, child_process_1.execSync)('openclaw setup', {
                    stdio: 'inherit',
                    timeout: 300000, // 5 min — user may need to do OAuth in browser
                });
                console.log('');
                console.log('  ✓ OpenClaw configured');
            }
            catch {
                console.log('');
                console.log('  ⚠ OpenClaw setup incomplete — you can run "openclaw setup" later to finish');
            }
            // Re-detect after install
            const freshDetected = detectOpenClaw();
            if (freshDetected) {
                // Ensure gateway token exists
                if (!freshDetected.token) {
                    freshDetected.token = ensureGatewayToken();
                }
                const agents = await fetchAgents(freshDetected.baseUrl, freshDetected.token);
                console.log(`  ✓ OpenClaw configured at ${freshDetected.baseUrl}`);
                console.log('');
                return { ...freshDetected, agents };
            }
            // Fall through to manual config
        }
        else {
            console.log('');
            console.log('  ⚠ Hearth requires OpenClaw to work.');
            console.log('  You can install it later with: npm install -g openclaw');
            console.log('');
        }
    }
    // If we got here via detected config but no token, ensure one
    const detectedAgain = detectOpenClaw();
    if (detectedAgain && !detectedAgain.token) {
        detectedAgain.token = ensureGatewayToken();
        const agents = await fetchAgents(detectedAgain.baseUrl, detectedAgain.token);
        console.log(`  ✓ OpenClaw configured at ${detectedAgain.baseUrl}`);
        console.log('');
        return { ...detectedAgain, agents };
    }
    // Manual configuration
    const answers = await inquirer_1.default.prompt([
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
        }
        else {
            console.log(`  ⚠ Gateway responded with status ${res.status}`);
        }
    }
    catch {
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
function ensureResponsesEndpoint() {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    try {
        if (!fs.existsSync(configPath))
            return;
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!config.gateway)
            config.gateway = {};
        if (!config.gateway.http)
            config.gateway.http = {};
        if (!config.gateway.http.endpoints)
            config.gateway.http.endpoints = {};
        if (!config.gateway.http.endpoints.responses) {
            config.gateway.http.endpoints.responses = { enabled: true };
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log('  ✓ Responses HTTP endpoint enabled');
        }
    }
    catch { /* ignore */ }
}
function ensureGatewayToken() {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    try {
        const config = fs.existsSync(configPath)
            ? JSON.parse(fs.readFileSync(configPath, 'utf-8'))
            : {};
        // Check if token already exists
        const existing = config.gateway?.auth?.token;
        if (!existing) {
            // Generate a new token
            const crypto = require('crypto');
            const token = crypto.randomBytes(24).toString('hex');
            if (!config.gateway)
                config.gateway = {};
            if (!config.gateway.auth)
                config.gateway.auth = {};
            config.gateway.auth.mode = 'token';
            config.gateway.auth.token = token;
            console.log('  ✓ Gateway token generated and saved');
        }
        // Ensure Responses HTTP endpoint is enabled (required for title generation)
        if (!config.gateway)
            config.gateway = {};
        if (!config.gateway.http)
            config.gateway.http = {};
        if (!config.gateway.http.endpoints)
            config.gateway.http.endpoints = {};
        if (!config.gateway.http.endpoints.responses) {
            config.gateway.http.endpoints.responses = { enabled: true };
            console.log('  ✓ Responses HTTP endpoint enabled');
        }
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        return config.gateway.auth.token;
    }
    catch {
        console.log('  ⚠ Could not generate gateway token — set it manually in ~/.openclaw/openclaw.json');
        return '';
    }
}
function detectOpenClaw() {
    // Check common config locations
    const configPaths = [
        path.join(os.homedir(), '.openclaw', 'openclaw.json'),
        path.join(os.homedir(), '.config', 'openclaw', 'openclaw.json'),
    ];
    for (const configPath of configPaths) {
        try {
            if (!fs.existsSync(configPath))
                continue;
            const raw = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(raw);
            const port = config.gateway?.port ?? 18789;
            const host = config.gateway?.host ?? '127.0.0.1';
            const baseUrl = `http://${host}:${port}`;
            // Try to find the token from gateway auth config
            const token = config.gateway?.auth?.token ?? config.gateway?.token ?? config.auth?.token ?? '';
            return { baseUrl, token };
        }
        catch {
            continue;
        }
    }
    // Try CLI detection
    try {
        const which = (0, child_process_1.execSync)('which openclaw 2>/dev/null', { encoding: 'utf-8' }).trim();
        if (which) {
            return { baseUrl: 'http://127.0.0.1:18789', token: '' };
        }
    }
    catch {
        // not found
    }
    return null;
}
async function fetchAgents(baseUrl, token) {
    try {
        const res = await fetch(`${baseUrl}/api/agents`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
            const data = await res.json();
            return Array.isArray(data) ? data.map((a) => a.id ?? a.name ?? a) : [];
        }
    }
    catch {
        // silent
    }
    return [];
}
