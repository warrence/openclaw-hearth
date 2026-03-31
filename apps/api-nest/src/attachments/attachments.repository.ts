import { Injectable } from '@nestjs/common';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { AttachmentsConfig } from '../config/attachments.config';

@Injectable()
export class AttachmentsRepository {
  constructor(private readonly config: AttachmentsConfig) {}

  async write(relativePath: string, content: Buffer): Promise<void> {
    const absolutePath = this.resolve(relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content);
  }

  async move(sourceRelativePath: string, targetRelativePath: string): Promise<void> {
    const targetPath = this.resolve(targetRelativePath);
    await mkdir(dirname(targetPath), { recursive: true });
    await rename(this.resolve(sourceRelativePath), targetPath);
  }

  async exists(relativePath: string): Promise<boolean> {
    try {
      await stat(this.resolve(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async read(relativePath: string): Promise<Buffer> {
    return readFile(this.resolve(relativePath));
  }

  async delete(relativePath: string): Promise<void> {
    await rm(this.resolve(relativePath), { force: true });
  }

  resolve(relativePath: string): string {
    return join(this.config.storageRoot, relativePath);
  }
}
