import { ConfigService } from '@nestjs/config';
import { AttachmentsRepository } from './attachments.repository';
import { AttachmentPayload, TemporaryAttachmentPayload } from './attachments.types';
export type UploadedFileLike = {
    originalname: string;
    mimetype: string;
    size: number;
    buffer: Buffer;
};
export declare class AttachmentsService {
    private readonly repository;
    private readonly config;
    constructor(configService: ConfigService, repository: AttachmentsRepository);
    storeTemporaryUpload(conversationId: number, file: UploadedFileLike | undefined): Promise<TemporaryAttachmentPayload>;
    finalizeUploads(userId: number, conversationId: number, tokens: string[]): Promise<AttachmentPayload[]>;
    private assertValidUpload;
    private getExtension;
    private formatAttachmentPayload;
    private detectCategory;
    private encryptToken;
    private decryptToken;
    private extractAttachmentText;
    private extractPdfText;
    private normalizeExtractedText;
    private isValidText;
    private toSlug;
}
