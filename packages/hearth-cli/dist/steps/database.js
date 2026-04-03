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
exports.setupDatabase = setupDatabase;
const inquirer_1 = __importDefault(require("inquirer"));
const pg_1 = require("pg");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function setupDatabase() {
    console.log('📦  Step 1/4: Database');
    console.log('');
    const answers = await inquirer_1.default.prompt([
        {
            type: 'input',
            name: 'host',
            message: 'PostgreSQL host:',
            default: '127.0.0.1',
        },
        {
            type: 'number',
            name: 'port',
            message: 'PostgreSQL port:',
            default: 5432,
        },
        {
            type: 'input',
            name: 'database',
            message: 'Database name:',
            default: 'hearth',
        },
        {
            type: 'input',
            name: 'user',
            message: 'Database user:',
            default: 'hearth',
        },
        {
            type: 'password',
            name: 'password',
            message: 'Database password:',
            default: 'hearth',
        },
    ]);
    const url = `postgresql://${answers.user}:${answers.password}@${answers.host}:${answers.port}/${answers.database}`;
    const client = new pg_1.Client({ connectionString: url });
    try {
        await client.connect();
        console.log('  ✓ Connected to PostgreSQL');
    }
    catch (err) {
        console.error(`  ✗ Connection failed: ${err.message}`);
        console.log('');
        console.log('  Make sure PostgreSQL is running and the database exists.');
        console.log(`  To create it: createdb ${answers.database}`);
        process.exit(1);
    }
    // Check if tables already exist
    const tableCheck = await client.query(`SELECT COUNT(*) as count FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name = 'users'`);
    const tablesExist = parseInt(tableCheck.rows[0].count, 10) > 0;
    if (tablesExist) {
        const { overwrite } = await inquirer_1.default.prompt([
            {
                type: 'confirm',
                name: 'overwrite',
                message: 'Tables already exist. Skip schema creation?',
                default: true,
            },
        ]);
        if (!overwrite) {
            await runSchema(client);
        }
        else {
            console.log('  ✓ Using existing schema');
        }
    }
    else {
        await runSchema(client);
    }
    console.log('  ✓ Database ready');
    console.log('');
    return {
        host: answers.host,
        port: answers.port,
        database: answers.database,
        user: answers.user,
        password: answers.password,
        url,
        client,
    };
}
async function runSchema(client) {
    const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(sql);
    console.log('  ✓ Schema created');
}
