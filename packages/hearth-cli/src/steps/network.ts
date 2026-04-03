import inquirer from 'inquirer';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface NetworkConfig {
  publicUrl: string;
  useCaddy: boolean;
  domain?: string;
  httpsPort: number;
  httpPort: number;
}

function detectPublicIp(): string | null {
  const services = ['https://ifconfig.me', 'https://api.ipify.org', 'https://icanhazip.com'];
  for (const url of services) {
    try {
      const ip = execSync(`curl -s --max-time 3 ${url}`, { stdio: 'pipe', timeout: 5000 })
        .toString()
        .trim();
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return ip;
    } catch { /* try next */ }
  }
  return null;
}

function detectLocalIp(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] ?? []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
  } catch { /* ignore */ }
  return '127.0.0.1';
}

function detectHostname(): string | null {
  try {
    const hostname = execSync('hostname -f', { stdio: 'pipe', timeout: 3000 }).toString().trim();
    if (hostname && hostname !== 'localhost' && !hostname.startsWith('ip-')) return hostname;
  } catch { /* ignore */ }
  return null;
}

function isPortAvailable(port: number): boolean {
  try {
    const output = execSync(`ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null`, {
      stdio: 'pipe',
      timeout: 3000,
    }).toString();
    return !output.includes(`:${port} `);
  } catch {
    return true; // assume available if we can't check
  }
}

function isCaddyInstalled(): boolean {
  try {
    execSync('which caddy', { stdio: 'pipe', timeout: 3000 });
    return true;
  } catch {
    return false;
  }
}

function installCaddy(): boolean {
  const platform = os.platform();
  try {
    if (platform === 'linux') {
      // Debian/Ubuntu
      console.log('  → Installing Caddy...');
      execSync(
        'sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl 2>/dev/null; ' +
        'curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg 2>/dev/null; ' +
        'curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null; ' +
        'sudo apt-get update -qq && sudo apt-get install -y caddy',
        { stdio: 'inherit', timeout: 120000 },
      );
      return true;
    } else if (platform === 'darwin') {
      execSync('brew install caddy', { stdio: 'pipe', timeout: 120000 });
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

function writeCaddyfile(domain: string, httpsPort: number, webPort: number, apiPort: number): string {
  const caddyfilePath = path.join(os.homedir(), 'hearth', 'Caddyfile');

  // If using IP (no domain), use self-signed HTTPS
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(domain);
  const portSuffix = httpsPort !== 443 ? `:${httpsPort}` : '';

  let content: string;
  if (isIp) {
    // IP-based: use automatic self-signed cert
    content = `${domain}${portSuffix} {
  tls internal

  handle /api/* {
    reverse_proxy localhost:${apiPort}
  }

  handle /storage/* {
    reverse_proxy localhost:${apiPort}
  }

  handle {
    reverse_proxy localhost:${webPort}
  }
}
`;
  } else {
    // Domain-based: Let's Encrypt auto-HTTPS
    content = `${domain}${portSuffix} {
  handle /api/* {
    reverse_proxy localhost:${apiPort}
  }

  handle /storage/* {
    reverse_proxy localhost:${apiPort}
  }

  handle {
    reverse_proxy localhost:${webPort}
  }
}
`;
  }

  const dir = path.dirname(caddyfilePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(caddyfilePath, content);
  return caddyfilePath;
}

export async function setupNetwork(): Promise<NetworkConfig> {
  console.log('🌐  Network & HTTPS');
  console.log('');

  // Detect addresses
  const localIp = detectLocalIp();
  const publicIp = detectPublicIp();
  const hostname = detectHostname();
  const port443Available = isPortAvailable(443);

  if (publicIp) console.log(`  → Public IP detected: ${publicIp}`);
  if (localIp !== '127.0.0.1') console.log(`  → Local IP: ${localIp}`);
  if (hostname) console.log(`  → Hostname: ${hostname}`);
  console.log('');

  // Ask about HTTPS
  const { wantHttps } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'wantHttps',
      message: 'Set up HTTPS with Caddy? (free automatic certificates)',
      default: true,
    },
  ]);

  if (!wantHttps) {
    const accessUrl = publicIp ? `http://${publicIp}:9100` : `http://${localIp}:9100`;
    console.log('');
    console.log(`  ✓ Hearth will be available at: ${accessUrl}`);
    console.log('');
    return {
      publicUrl: accessUrl,
      useCaddy: false,
      httpsPort: 443,
      httpPort: 9100,
    };
  }

  // Build address choices
  const choices: Array<{ name: string; value: string }> = [];
  if (hostname) choices.push({ name: `${hostname} (hostname — recommended for Let's Encrypt)`, value: hostname });
  if (publicIp) choices.push({ name: `${publicIp} (public IP — self-signed cert)`, value: publicIp });
  if (localIp !== '127.0.0.1') choices.push({ name: `${localIp} (local network)`, value: localIp });
  choices.push({ name: 'Enter a custom domain or IP', value: '__custom__' });

  const { selectedAddress } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedAddress',
      message: 'Which address should Hearth use?',
      choices,
    },
  ]);

  let domain = selectedAddress;
  if (domain === '__custom__') {
    const { customDomain } = await inquirer.prompt([
      {
        type: 'input',
        name: 'customDomain',
        message: 'Enter your domain or IP:',
        validate: (v: string) => v.trim().length > 0 || 'Required',
      },
    ]);
    domain = customDomain.trim();
  }

  // Ask for HTTPS port
  const { httpsPort } = await inquirer.prompt([
    {
      type: 'input',
      name: 'httpsPort',
      message: `HTTPS port:`,
      default: port443Available ? '443' : '8443',
      validate: (v: string) => {
        const n = Number(v);
        return (Number.isInteger(n) && n > 0 && n < 65536) || 'Enter a valid port number';
      },
    },
  ]);

  const portNum = Number(httpsPort);

  // Install Caddy if needed
  if (!isCaddyInstalled()) {
    console.log('');
    const { installNow } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'installNow',
        message: 'Caddy is not installed. Install it now?',
        default: true,
      },
    ]);

    if (installNow) {
      const installed = installCaddy();
      if (!installed) {
        console.error('  ✗ Caddy installation failed. Install manually: https://caddyserver.com/docs/install');
        const accessUrl = `http://${domain}:9100`;
        return { publicUrl: accessUrl, useCaddy: false, httpsPort: portNum, httpPort: 9100 };
      }
      console.log('  ✓ Caddy installed');
    } else {
      const accessUrl = `http://${domain}:9100`;
      return { publicUrl: accessUrl, useCaddy: false, httpsPort: portNum, httpPort: 9100 };
    }
  } else {
    console.log('  ✓ Caddy already installed');
  }

  // Write Caddyfile
  const caddyfilePath = writeCaddyfile(domain, portNum, 9100, 3001);
  console.log(`  ✓ Caddyfile written: ${caddyfilePath}`);

  // Start Caddy
  try {
    // Stop existing Caddy if running
    try { execSync('caddy stop 2>/dev/null', { stdio: 'pipe', timeout: 5000 }); } catch { /* ignore */ }
    execSync(`caddy start --config ${caddyfilePath}`, { stdio: 'pipe', timeout: 10000 });
    console.log('  ✓ Caddy started');
  } catch (err: any) {
    console.warn(`  ⚠ Could not start Caddy: ${err.message?.split('\n')[0]}`);
    console.log(`    Start manually: caddy start --config ${caddyfilePath}`);
  }

  const portSuffix = portNum !== 443 ? `:${portNum}` : '';
  const publicUrl = `https://${domain}${portSuffix}`;

  console.log('');
  console.log(`  ✓ Hearth will be available at: ${publicUrl}`);
  console.log('');

  return {
    publicUrl,
    useCaddy: true,
    domain,
    httpsPort: portNum,
    httpPort: 9100,
  };
}
