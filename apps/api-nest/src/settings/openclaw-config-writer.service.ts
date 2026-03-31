import { Injectable, Logger } from '@nestjs/common';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

/**
 * Hearth-specific runtime config stored in ~/.openclaw/hearth.json
 *
 * IMPORTANT: We deliberately do NOT write to openclaw.json — OpenClaw
 * validates that file against a strict Zod schema and rejects unknown keys,
 * which would prevent the gateway from starting.
 */
const HEARTH_CONFIG_PATH = join(homedir(), '.openclaw', 'hearth.json');

@Injectable()
export class OpenClawConfigWriterService {
  private readonly logger = new Logger(OpenClawConfigWriterService.name);

  /**
   * Read the current hearth.json as a plain object.
   */
  read(): Record<string, unknown> {
    try {
      const raw = readFileSync(HEARTH_CONFIG_PATH, 'utf8');
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }

  /**
   * Write a deep-merged patch into hearth.json.
   */
  patch(patch: Record<string, unknown>): void {
    const current = this.read();
    const merged = deepMerge(current, patch);
    try {
      mkdirSync(dirname(HEARTH_CONFIG_PATH), { recursive: true });
      writeFileSync(HEARTH_CONFIG_PATH, JSON.stringify(merged, null, 2), 'utf8');
    } catch (err) {
      this.logger.error(`Failed to write hearth.json: ${String(err)}`);
      throw err;
    }
  }

  /**
   * Read a nested value by dot-path (e.g. "modelPresets.fast").
   */
  get<T = unknown>(path: string): T | undefined {
    const obj = this.read();
    return getNestedValue<T>(obj, path.split('.'));
  }
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const sv = source[key];
    const tv = target[key];
    if (
      sv !== null &&
      typeof sv === 'object' &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === 'object' &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMerge(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>,
      );
    } else {
      result[key] = sv;
    }
  }
  return result;
}

function getNestedValue<T>(obj: unknown, keys: string[]): T | undefined {
  if (keys.length === 0 || obj === null || typeof obj !== 'object') {
    return obj as T;
  }
  const head = keys[0];
  const rest = keys.slice(1);
  if (head === undefined) return obj as T;
  const next = (obj as Record<string, unknown>)[head];
  return rest.length === 0 ? (next as T) : getNestedValue<T>(next, rest);
}
