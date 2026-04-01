import inquirer from 'inquirer';
import * as bcrypt from 'bcrypt';
import type { DatabaseConfig } from './database';

export async function setupOwner(db: DatabaseConfig): Promise<void> {
  console.log('👤  Owner account');
  console.log('');

  // Check if owner already exists
  const existing = await db.client.query(
    `SELECT id, name FROM users WHERE role = 'owner' LIMIT 1`
  );

  if (existing.rows.length > 0) {
    console.log(`  ✓ Owner account exists: ${existing.rows[0].name}`);
    const { keepExisting } = await inquirer.prompt([
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

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'Owner name:',
      validate: (v: string) => v.trim().length > 0 || 'Name is required',
    },
    {
      type: 'password',
      name: 'pin',
      message: 'Set a PIN (4+ characters):',
      validate: (v: string) => v.length >= 4 || 'PIN must be at least 4 characters — this is required to log in',
    },
  ]);

  const name = answers.name.trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const memoryNamespace = `person:${slug}`;
  const now = new Date().toISOString();
  const pinHash = await hashPin(answers.pin);

  await db.client.query(
    `INSERT INTO users (name, slug, memory_namespace, role, is_active, requires_pin, pin_hash, pin_set_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'owner', true, true, $4, $5, $6, $6)
     ON CONFLICT (slug) DO UPDATE SET role = 'owner', name = $1, pin_hash = $4, pin_set_at = $5, requires_pin = true, updated_at = $6`,
    [name, slug, memoryNamespace, pinHash, now, now]
  );

  console.log(`  ✓ Owner account created: ${name}`);
  console.log('');
}

async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}
