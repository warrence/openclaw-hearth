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
exports.setupAgent = setupAgent;
const inquirer_1 = __importDefault(require("inquirer"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
function detectAgentsFromConfig() {
    const agents = [];
    const configPaths = [
        path.join(os.homedir(), '.openclaw', 'openclaw.json'),
        path.join(os.homedir(), '.config', 'openclaw', 'openclaw.json'),
    ];
    for (const configPath of configPaths) {
        try {
            if (!fs.existsSync(configPath))
                continue;
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (config.agents?.entries) {
                agents.push(...Object.keys(config.agents.entries));
            }
            if (config.agents?.default && !agents.includes(config.agents.default)) {
                agents.unshift(config.agents.default);
            }
        }
        catch {
            continue;
        }
    }
    const agentsDir = path.join(os.homedir(), '.openclaw', 'agents');
    try {
        if (fs.existsSync(agentsDir)) {
            const dirs = fs.readdirSync(agentsDir).filter((d) => {
                return fs.statSync(path.join(agentsDir, d)).isDirectory() && !d.startsWith('.');
            });
            for (const d of dirs) {
                if (!agents.includes(d))
                    agents.push(d);
            }
        }
    }
    catch {
        // ignore
    }
    return agents;
}
async function setupAgent(openclaw) {
    console.log('🤖  Agent configuration');
    console.log('');
    const detectedAgents = detectAgentsFromConfig();
    const allAgents = [...new Set([...openclaw.agents, ...detectedAgents])];
    let defaultAgent = 'main';
    if (allAgents.length > 0) {
        console.log('  Available agents:');
        allAgents.forEach((a) => console.log(`    - ${a}`));
        console.log('');
        defaultAgent = allAgents[0];
    }
    else {
        console.log('  No agents detected — using default "main" agent.');
        console.log('');
    }
    const { agentId } = await inquirer_1.default.prompt([
        {
            type: allAgents.length > 1 ? 'list' : 'input',
            name: 'agentId',
            message: 'Which OpenClaw agent should Hearth use?',
            choices: allAgents.length > 1 ? allAgents : undefined,
            default: defaultAgent,
        },
    ]);
    // Default display name: capitalize the agent ID (e.g. "main" → "Main")
    const defaultDisplayName = agentId.charAt(0).toUpperCase() + agentId.slice(1);
    const { displayName } = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'displayName',
            message: 'Display name for the agent in the app (e.g. Jarvis, Nova, Sage):',
            default: defaultDisplayName,
        },
    ]);
    console.log(`  ✓ Agent: ${displayName} (${agentId})`);
    console.log('');
    return {
        agentId,
        displayName,
    };
}
