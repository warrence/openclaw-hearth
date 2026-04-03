"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runSetup = runSetup;
const database_1 = require("./database");
const openclaw_1 = require("./openclaw");
const owner_1 = require("./owner");
const agent_1 = require("./agent");
const env_1 = require("./env");
const install_1 = require("./install");
const personalize_1 = require("./personalize");
const network_1 = require("./network");
const inquirer_1 = __importDefault(require("inquirer"));
async function runSetup() {
    console.log('');
    console.log('🏠  Welcome to Hearth — household assistant setup');
    console.log('─'.repeat(50));
    console.log('');
    // Step 1: Install dependencies
    await (0, install_1.installDependencies)();
    // Step 2: Database
    const db = await (0, database_1.setupDatabase)();
    // Step 3: OpenClaw (install + run openclaw setup for model/auth)
    const openclaw = await (0, openclaw_1.setupOpenClaw)();
    // Step 4: Owner account
    await (0, owner_1.setupOwner)(db);
    // Step 5: Agent config
    const agent = await (0, agent_1.setupAgent)(openclaw);
    // Step 6: Install Hearth plugin into OpenClaw (generates channel token)
    const pluginTokens = await (0, install_1.installPlugin)();
    // Step 7: Write .env (includes all tokens)
    await (0, env_1.writeEnvFile)({ db, openclaw, agent, pluginTokens });
    // Step 8: Build web app
    await (0, install_1.buildWebApp)();
    // Step 9: Network & HTTPS
    const network = await (0, network_1.setupNetwork)();
    // Optional: Personalize (pass in the name already chosen)
    console.log('');
    const { personalize } = await inquirer_1.default.prompt([
        {
            type: 'confirm',
            name: 'personalize',
            message: 'Set up your assistant\'s personality now?',
            default: true,
        },
    ]);
    if (personalize) {
        await (0, personalize_1.runPersonalize)(agent.displayName);
    }
    console.log('');
    console.log('━'.repeat(50));
    console.log('✅  Hearth is installed!');
    console.log('');
    console.log('  ⚠️  Before you start chatting:');
    console.log('');
    console.log('  1. Set up your AI provider:');
    console.log('');
    console.log('     openclaw config');
    console.log('');
    console.log('     This will ask you to choose a model (e.g. OpenAI,');
    console.log('     Anthropic, Google) and sign in with OAuth.');
    console.log('     Without this, your assistant can\'t respond.');
    console.log('');
    console.log('  2. Start OpenClaw + Hearth:');
    console.log('');
    // Detect systemd
    const hasSystemd = (() => { try {
        require('child_process').execSync('systemctl --version', { stdio: 'pipe', timeout: 3000 });
        return true;
    }
    catch {
        return false;
    } })();
    if (hasSystemd) {
        console.log('     openclaw gateway install   # install as system service');
        console.log('     openclaw gateway start');
    }
    else {
        console.log('     openclaw gateway &          # no systemd — run in background');
    }
    console.log('     cd ~/hearth && npm run start');
    console.log('');
    console.log('  3. Open in your browser:');
    console.log('');
    console.log(`     ${network.publicUrl}`);
    console.log('');
    console.log('  📖 Enhance your assistant:');
    console.log('     docs/enhance-your-assistant.md');
    if (!personalize) {
        console.log('  🎭 Personalize later:');
        console.log('     npx hearth personalize');
    }
    console.log('━'.repeat(50));
    console.log('');
    db.client.end();
}
