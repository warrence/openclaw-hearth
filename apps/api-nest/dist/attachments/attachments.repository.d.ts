import { AttachmentsConfig } from '../config/attachments.config';
export declare class AttachmentsRepository {
    private readonly config;
    constructor(config: AttachmentsConfig);
    write(relativePath: string, content: Buffer): Promise<void>;
    move(sourceRelativePath: string, targetRelativePath: string): Promise<void>;
    exists(relativePath: string): Promise<boolean>;
    read(relativePath: string): Promise<Buffer>;
    delete(relativePath: string): Promise<void>;
    resolve(relativePath: string): string;
}
