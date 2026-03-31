import inquirer from 'inquirer';
import * as bcrypt from 'bcrypt';
import type { DatabaseConfig } from './database';

export async function setupOwner(db: DatabaseConfig): Promise<void> {
  console.log('👤  Step 3/4: Owner account');
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
      type: 'confirm',
      name: 'setPin',
      message: 'Set a PIN for this account?',
      default: false,
    },
    {
      type: 'password',
      name: 'pin',
      message: 'Enter PIN:',
      when: (a: any) => a.setPin,
      validate: (v: string) => v.length >= 4 || 'PIN must be at least 4 characters',
    },
  ]);

  const name = answers.name.trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const memoryNamespace = `person:${slug}`;
  const now = new Date().toISOString();
  const pinHash = answers.pin ? await hashPin(answers.pin) : null;

  await db.client.query(
    `INSERT INTO users (name, slug, memory_namespace, role, is_active, requires_pin, pin_hash, pin_set_at, created_at, updated_at)
     VALUES ($1, $2, $3, 'owner', true, $4, $5, $6, $7, $7)
     ON CONFLICT (slug) DO UPDATE SET role = 'owner', name = $1, updated_at = $7`,
    [name, slug, memoryNamespace, !!answers.pin, pinHash, answers.pin ? now : null, now]
  );

  console.log(`  ✓ Owner account created: ${name}`);
  console.log('');
}

async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}
