import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { OpenClawConfig } from '../config/openclaw.config';
import { GatewayConnectionRecord } from './settings.repository';
import { LaravelCryptoService } from './laravel-crypto.service';

const execFileAsync = promisify(execFile);

export class OpenClawGatewayHealthError extends Error {}

@Injectable()
export class OpenClawGatewayHealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: LaravelCryptoService,
  ) {}

  async health(gateway: GatewayConnectionRecord | null): Promise<Record<string, unknown>> {
    const config = this.getConfig();
    const command = this.buildHealthCommand(
      this.shouldUseLocalGatewayDefaults(gateway, config.baseUrl)
        ? {}
        : {
            baseUrl: gateway?.base_url,
            token: this.decryptGatewayToken(gateway, config.token),
          },
    );

    return this.runHealthCommand(command);
  }

  async testConnection(
    baseUrl: string,
    token?: string | null,
  ): Promise<Record<string, unknown>> {
    return this.runHealthCommand(
      this.buildHealthCommand({
        baseUrl,
        token: this.normalizeTokenValue(token),
      }),
    );
  }

  private decryptGatewayToken(
    gateway: GatewayConnectionRecord | null,
    fallbackToken?: string,
  ): string | null {
    const encrypted = gateway?.auth_token_encrypted;

    if (!encrypted) {
      return this.normalizeTokenValue(fallbackToken);
    }

    const decrypted = this.cryptoService.tryDecryptString(encrypted);
    return this.normalizeTokenValue(decrypted ?? fallbackToken ?? null);
  }

  private normalizeTokenValue(token: string | null | undefined): string | null {
    if (!token) {
      return null;
    }

    const trimmed = token.trim();
    if (trimmed === '') {
      return null;
    }

    const serializedMatch = /^s:\d+:"(.*)";$/.exec(trimmed);
    return serializedMatch?.[1] ?? trimmed;
  }

  private shouldUseLocalGatewayDefaults(
    gateway: GatewayConnectionRecord | null,
    configuredBaseUrl?: string,
  ): boolean {
    const baseUrl = gateway?.base_url || configuredBaseUrl;

    if (!baseUrl) {
      return true;
    }

    return ['ws://127.0.0.1:18789', 'ws://localhost:18789'].includes(
      this.normalizeGatewayUrl(baseUrl),
    );
  }

  private normalizeGatewayUrl(baseUrl: string): string {
    const trimmed = baseUrl.trim().replace(/\/+$/, '');

    if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
      return trimmed;
    }

    return trimmed.replace(/^http/i, 'ws');
  }

  private buildHealthCommand(params: {
    baseUrl?: string | null;
    token?: string | null;
  }): string[] {
    const command = [
      'gateway',
      'call',
      'health',
      '--json',
      '--timeout',
      '10000',
    ];

    if (params.baseUrl) {
      command.push('--url', this.normalizeGatewayUrl(params.baseUrl));
    }

    if (params.token) {
      command.push('--token', params.token);
    }

    return command;
  }

  private async runHealthCommand(
    command: string[],
  ): Promise<Record<string, unknown>> {
    const cliBin = this.resolveCliBin();

    try {
      const { stdout } = await execFileAsync(cliBin, command, {
        env: {
          ...process.env,
          PATH:
            process.env.PATH ??
            '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin',
        },
      });

      return JSON.parse(this.extractJsonPayload(stdout)) as Record<string, unknown>;
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim() !== ''
          ? error.message
          : 'OpenClaw gateway call failed.';
      throw new OpenClawGatewayHealthError(message);
    }
  }

  private extractJsonPayload(output: string): string {
    const trimmed = output.trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');

    if (start === -1 || end === -1 || end < start) {
      throw new OpenClawGatewayHealthError(
        'OpenClaw returned no JSON payload.',
      );
    }

    return trimmed.slice(start, end + 1);
  }

  private resolveCliBin(): string {
    return process.env.OPENCLAW_CLI_BIN?.trim() || 'openclaw';
  }

  private getConfig(): OpenClawConfig {
    return this.configService.getOrThrow<OpenClawConfig>('openclaw', {
      infer: true,
    });
  }
}
