import inquirer from 'inquirer';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  url: string;
  client: Client;
}

export async function setupDatabase(): Promise<DatabaseConfig> {
  console.log('📦  Step 1/4: Database');
  console.log('');

  const answers = await inquirer.prompt([
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
  const client = new Client({ connectionString: url });

  try {
    await client.connect();
    console.log('  ✓ Connected to PostgreSQL');
  } catch (err: any) {
    console.error(`  ✗ Connection failed: ${err.message}`);
    console.log('');
    console.log('  Make sure PostgreSQL is running and the database exists.');
    console.log(`  To create it: createdb ${answers.database}`);
    process.exit(1);
  }

  // Check if tables already exist
  const tableCheck = await client.query(
    `SELECT COUNT(*) as count FROM information_schema.tables 
     WHERE table_schema = 'public' AND table_name = 'users'`
  );
  const tablesExist = parseInt(tableCheck.rows[0].count, 10) > 0;

  if (tablesExist) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'Tables already exist. Skip schema creation?',
        default: true,
      },
    ]);
    if (!overwrite) {
      await runSchema(client);
    } else {
      console.log('  ✓ Using existing schema');
    }
  } else {
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

async function runSchema(client: Client): Promise<void> {
  const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  await client.query(sql);
  console.log('  ✓ Schema created');
}
