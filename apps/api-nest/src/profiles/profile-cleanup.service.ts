import { Injectable, Logger } from '@nestjs/common';
import { rm, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export interface ProfileCleanupOptions {
  profileId: number;
  /** All openclaw_session_key values from the user's conversations */
  sessionKeys: string[];
  /** All conversation IDs for the user (for storage file cleanup) */
  conversationIds: (string | number)[];
}

@Injectable()
export class ProfileCleanupService {
  private readonly logger = new Logger(ProfileCleanupService.name);

  private get agentStorePath(): string {
    return process.env.OPENCLAW_AGENT_STORE_PATH ?? '';
  }

  private get storagePath(): string {
    return process.env.HEARTH_STORAGE_PATH ?? '';
  }

  /**
   * Cleans up all OpenClaw session files and storage attachments for a profile.
   * Runs best-effort — errors are logged but not thrown, so profile deletion still succeeds.
   */
  async cleanupProfileData(options: ProfileCleanupOptions): Promise<void> {
    await Promise.allSettled([
      this.cleanupOpenClawSessions(options.sessionKeys),
      this.cleanupStorageFiles(options.profileId, options.conversationIds),
    ]);
  }

  private async cleanupOpenClawSessions(sessionKeys: string[]): Promise<void> {
    if (!sessionKeys.length || !this.agentStorePath) return;

    // Group session keys by agent id (extracted from key prefix "agent:<agentId>:...")
    const keysByAgent = new Map<string, string[]>();

    for (const key of sessionKeys) {
      const normalizedKey = key.trim().toLowerCase();
      // Key format: agent:<agentId>:<rest>
      const match = normalizedKey.match(/^agent:([^:]+):/);
      const agentId = match?.[1];
      if (!agentId) continue;

      if (!keysByAgent.has(agentId)) {
        keysByAgent.set(agentId, []);
      }
      keysByAgent.get(agentId)!.push(normalizedKey);
    }

    for (const [agentId, keys] of keysByAgent) {
      await this.cleanupAgentSessions(agentId, keys);
    }
  }

  private async cleanupAgentSessions(agentId: string, sessionKeys: string[]): Promise<void> {
    const sessionsDir = join(this.agentStorePath, agentId, 'sessions');
    const indexPath = join(sessionsDir, 'sessions.json');

    if (!existsSync(indexPath)) {
      this.logger.debug(`No sessions index found for agent ${agentId}`);
      return;
    }

    let index: Record<string, { sessionId: string }>;

    try {
      const raw = await readFile(indexPath, 'utf-8');
      index = JSON.parse(raw);
    } catch (err) {
      this.logger.warn(`Failed to read sessions index for agent ${agentId}: ${err}`);
      return;
    }

    const sessionIdsToDelete: string[] = [];

    for (const key of sessionKeys) {
      const entry = index[key];
      if (entry?.sessionId) {
        sessionIdsToDelete.push(entry.sessionId);
        delete index[key];
        this.logger.log(`Removing session key from index: ${key}`);
      }
    }

    if (!sessionIdsToDelete.length) {
      return;
    }

    // Write updated index
    try {
      await writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
    } catch (err) {
      this.logger.warn(`Failed to write updated sessions index for agent ${agentId}: ${err}`);
    }

    // Delete session JSONL files
    for (const sessionId of sessionIdsToDelete) {
      const filePath = join(sessionsDir, `${sessionId}.jsonl`);
      try {
        await rm(filePath, { force: true });
        this.logger.log(`Deleted session file: ${filePath}`);
      } catch (err) {
        this.logger.warn(`Failed to delete session file ${filePath}: ${err}`);
      }
    }
  }

  private async cleanupStorageFiles(profileId: number, conversationIds: (string | number)[]): Promise<void> {
    if (!this.storagePath) return;

    // New structure: attachments/users/<userId>/ — one rm covers everything
    const userDir = join(this.storagePath, 'attachments', 'users', String(profileId));
    if (existsSync(userDir)) {
      try {
        await rm(userDir, { recursive: true, force: true });
        this.logger.log(`Deleted user storage dir: ${userDir}`);
      } catch (err) {
        this.logger.warn(`Failed to delete user storage dir ${userDir}: ${err}`);
      }
    }

    // Also clean legacy tmp dirs keyed by conversationId (pre-migration files)
    if (conversationIds.length) {
      const tmpBase = join(this.storagePath, 'attachments', 'tmp');
      if (existsSync(tmpBase)) {
        for (const conversationId of conversationIds) {
          const dirPath = join(tmpBase, String(conversationId));
          if (!existsSync(dirPath)) continue;
          try {
            await rm(dirPath, { recursive: true, force: true });
            this.logger.log(`Deleted tmp dir for conversation ${conversationId}`);
          } catch (err) {
            this.logger.warn(`Failed to delete tmp dir ${dirPath}: ${err}`);
          }
        }
      }
    }
  }
}
