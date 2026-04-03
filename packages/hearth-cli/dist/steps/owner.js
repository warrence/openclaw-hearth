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
exports.setupOwner = setupOwner;
const inquirer_1 = __importDefault(require("inquirer"));
const bcrypt = __importStar(require("bcrypt"));
async function setupOwner(db) {
    console.log('👤  Owner account');
    console.log('');
    // Check if owner already exists
    const existing = await db.client.query(`SELECT id, name FROM users WHERE role = 'owner' LIMIT 1`);
    if (existing.rows.length > 0) {
        console.log(`  ✓ Owner account exists: ${existing.rows[0].name}`);
        const { keepExisting } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'keepExisting',
                message: 'Keep existing owner account?',
                default: true,
            },
        ]);
        if (keepExisting) {
            console.log('');
            return;
        }
    }
    const answers = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Owner name:',
            validate: (v) => v.trim().length > 0 || 'Name is required',
        },
        {
            type: 'password',
            name: 'pin',
            message: 'Set a PIN (4+ characters):',
            validate: (v) => v.length >= 4 || 'PIN must be at least 4 characters — this is required to log in',
        },
    ]);
    const name = answers.name.trim();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const memoryNamespace = `person:${slug}`;
    const now = new Date().toISOString();
    const pinHash = await hashPin(answers.pin);
    await db.client.query(`INSERT INTO users (name, slug, memory_namespace, role, is_active, requires_pin, pin_hash, pin_set_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'owner', true, true, $4, $5, $6, $6)
     ON CONFLICT (slug) DO UPDATE SET role = 'owner', name = $1, pin_hash = $4, pin_set_at = $5, requires_pin = true, updated_at = $6`, [name, slug, memoryNamespace, pinHash, now, now]);
    console.log(`  ✓ Owner account created: ${name}`);
    console.log('');
}
async function hashPin(pin) {
    return bcrypt.hash(pin, 10);
}
