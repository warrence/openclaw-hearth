import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export async function runPersonalize(): Promise<void> {
  console.log('');
  console.log('🎭  Personalize Your Assistant');
  console.log('─'.repeat(50));
  console.log('');
  console.log('  Answer a few questions and we\'ll create a personality');
  console.log('  profile for your assistant. You can change it anytime.');
  console.log('');

  // Name
  const { name } = await inquirer.prompt([
    {
      type: 'input',
      name: 'name',
      message: 'What should your assistant\'s name be?',
      default: 'Assistant',
      validate: (v: string) => v.trim().length > 0 || 'A name is required',
    },
  ]);

  // Personality vibe
  const { vibe } = await inquirer.prompt([
    {
      type: 'list',
      name: 'vibe',
      message: 'What\'s the personality vibe?',
      choices: [
        { name: 'Warm & friendly — like a family member', value: 'warm' },
        { name: 'Professional — helpful but focused', value: 'professional' },
        { name: 'Playful — fun, uses emoji and humor', value: 'playful' },
        { name: 'Minimal — short, direct answers', value: 'minimal' },
      ],
    },
  ]);

  // Communication style
  const { addressStyle } = await inquirer.prompt([
    {
      type: 'list',
      name: 'addressStyle',
      message: 'How should it address your household?',
      choices: [
        { name: 'By first names (casual)', value: 'firstnames' },
        { name: 'Formal (Mr./Mrs./Ms.)', value: 'formal' },
        { name: 'Nicknames (you can set them later)', value: 'nicknames' },
      ],
    },
  ]);

  // Language
  const { language } = await inquirer.prompt([
    {
      type: 'input',
      name: 'language',
      message: 'What languages does your household speak?',
      default: 'English',
    },
  ]);

  // Boundaries
  const { boundaries } = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'boundaries',
      message: 'What boundaries should the assistant follow?',
      choices: [
        { name: 'Never share private chats between family members', value: 'privacy', checked: true },
        { name: 'Ask before spending money or making commitments', value: 'money', checked: true },
        { name: 'Keep things age-appropriate for kids', value: 'kids', checked: true },
        { name: 'Avoid giving medical advice — suggest seeing a doctor', value: 'medical', checked: false },
        { name: 'Don\'t discuss politics or religion', value: 'politics', checked: false },
        { name: 'Be honest when uncertain — don\'t make things up', value: 'honesty', checked: true },
      ],
    },
  ]);

  // Special instructions
  const { special } = await inquirer.prompt([
    {
      type: 'input',
      name: 'special',
      message: 'Any special instructions? (optional — press Enter to skip)',
    },
  ]);

  // Household members
  const { addMembers } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'addMembers',
      message: 'Add household member descriptions? (helps the assistant know your family)',
      default: true,
    },
  ]);

  const members: Array<{ name: string; role: string; notes: string }> = [];
  if (addMembers) {
    let addMore = true;
    while (addMore) {
      const member = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Member name:',
        },
        {
          type: 'input',
          name: 'role',
          message: 'Role in household (e.g. Dad, Mom, Son, Daughter):',
        },
        {
          type: 'input',
          name: 'notes',
          message: 'Anything the assistant should know? (optional):',
        },
      ]);
      members.push(member);

      const { more } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'more',
          message: 'Add another member?',
          default: false,
        },
      ]);
      addMore = more;
    }
  }

  // Generate SOUL.md
  const soul = generateSoul({ name, vibe, addressStyle, language, boundaries, special, members });

  // Write SOUL.md
  const workspaceDir = path.join(os.homedir(), '.openclaw', 'workspace');
  const soulPath = path.join(workspaceDir, 'SOUL.md');

  if (!fs.existsSync(workspaceDir)) {
    fs.mkdirSync(workspaceDir, { recursive: true });
  }

  if (fs.existsSync(soulPath)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: 'SOUL.md already exists. Overwrite it?',
        default: false,
      },
    ]);
    if (!overwrite) {
      const backupPath = soulPath + '.new';
      fs.writeFileSync(backupPath, soul);
      console.log(`  → Saved as ${backupPath} (review and rename when ready)`);
      console.log('');
      return;
    }
  }

  fs.writeFileSync(soulPath, soul);

  // Also save display name to hearth.json
  const hearthJsonPath = path.join(os.homedir(), '.openclaw', 'hearth.json');
  try {
    const hearthConfig: Record<string, unknown> = fs.existsSync(hearthJsonPath)
      ? JSON.parse(fs.readFileSync(hearthJsonPath, 'utf-8'))
      : {};
    hearthConfig.agentDisplayName = name.trim();
    fs.writeFileSync(hearthJsonPath, JSON.stringify(hearthConfig, null, 2));
  } catch {
    // ignore
  }

  console.log('');
  console.log('━'.repeat(50));
  console.log(`✅  ${name} is ready!`);
  console.log('');
  console.log(`  Personality: ${vibeLabel(vibe)}`);
  console.log(`  Language: ${language}`);
  console.log(`  Addresses family: ${addressLabel(addressStyle)}`);
  if (members.length > 0) {
    console.log(`  Knows ${members.length} family member${members.length > 1 ? 's' : ''}`);
  }
  console.log('');
  console.log(`  Edit anytime: ${soulPath}`);
  console.log('━'.repeat(50));
  console.log('');
}

function vibeLabel(vibe: string): string {
  const labels: Record<string, string> = {
    warm: 'Warm & friendly',
    professional: 'Professional & focused',
    playful: 'Playful & fun',
    minimal: 'Minimal & direct',
  };
  return labels[vibe] ?? vibe;
}

function addressLabel(style: string): string {
  const labels: Record<string, string> = {
    firstnames: 'By first names',
    formal: 'Formally (Mr./Mrs.)',
    nicknames: 'By nicknames',
  };
  return labels[style] ?? style;
}

interface SoulParams {
  name: string;
  vibe: string;
  addressStyle: string;
  language: string;
  boundaries: string[];
  special: string;
  members: Array<{ name: string; role: string; notes: string }>;
}

function generateSoul(params: SoulParams): string {
  const { name, vibe, addressStyle, language, boundaries, special, members } = params;

  const vibeDescriptions: Record<string, string> = {
    warm: `You are ${name}, a warm and caring household assistant. You feel like part of the family — supportive, thoughtful, and genuinely interested in everyone's wellbeing. You're conversational and natural, not robotic.`,
    professional: `You are ${name}, a reliable and focused household assistant. You're helpful and respectful, keeping things clear and organized. You're friendly but don't overdo casual conversation — you value everyone's time.`,
    playful: `You are ${name}, a fun and energetic household assistant. You love using emoji, making lighthearted jokes, and keeping the mood positive. You're helpful and smart, but never boring. You make everyday tasks feel a little more fun.`,
    minimal: `You are ${name}, an efficient household assistant. You give clear, concise answers without unnecessary filler. You're helpful and accurate, but you respect that people are busy and don't want to read paragraphs when a sentence will do.`,
  };

  const addressDescriptions: Record<string, string> = {
    firstnames: 'Address family members by their first names in a casual, friendly way.',
    formal: 'Address family members formally (Mr., Mrs., Ms.) unless they ask you to be casual.',
    nicknames: 'Use nicknames for family members when you know them. Be warm and personal.',
  };

  const boundaryMap: Record<string, string> = {
    privacy: 'Never share one family member\'s private conversations, messages, or personal information with another member.',
    money: 'Always ask for explicit approval before suggesting purchases, commitments, or anything that costs money.',
    kids: 'Keep all content age-appropriate when talking to children. Adjust your language and topics based on who you\'re speaking with.',
    medical: 'Don\'t give specific medical advice. If someone has a health concern, suggest they consult a doctor or medical professional.',
    politics: 'Avoid discussing politics, religion, or other divisive topics unless specifically asked, and even then stay neutral.',
    honesty: 'Be honest when you\'re not sure about something. Say "I\'m not certain" rather than making things up. It\'s better to be helpful and honest than confidently wrong.',
  };

  let soul = `# SOUL.md\n\n`;
  soul += `## Who You Are\n\n`;
  soul += `${vibeDescriptions[vibe] ?? vibeDescriptions.warm}\n\n`;

  soul += `## Language\n\n`;
  soul += `The household speaks: ${language}.\n`;
  soul += `Communicate in whatever language the person is using. If they switch languages, follow their lead.\n\n`;

  soul += `## How You Address the Family\n\n`;
  soul += `${addressDescriptions[addressStyle] ?? addressDescriptions.firstnames}\n\n`;

  if (members.length > 0) {
    soul += `## The Household\n\n`;
    for (const m of members) {
      soul += `- **${m.name}** — ${m.role}`;
      if (m.notes?.trim()) {
        soul += `. ${m.notes.trim()}`;
      }
      soul += `\n`;
    }
    soul += `\n`;
  }

  if (boundaries.length > 0) {
    soul += `## Boundaries\n\n`;
    for (const b of boundaries) {
      if (boundaryMap[b]) {
        soul += `- ${boundaryMap[b]}\n`;
      }
    }
    soul += `\n`;
  }

  if (special?.trim()) {
    soul += `## Special Instructions\n\n`;
    soul += `${special.trim()}\n\n`;
  }

  soul += `## General Guidelines\n\n`;
  soul += `- You're a household assistant, not a corporate chatbot. Be natural.\n`;
  soul += `- Remember context from previous conversations when possible.\n`;
  soul += `- If someone asks you to set a reminder, do it without over-explaining.\n`;
  soul += `- When you don't know something, offer to look it up rather than guessing.\n`;
  soul += `- Keep responses at a reasonable length — don't write essays unless asked.\n`;

  return soul;
}
