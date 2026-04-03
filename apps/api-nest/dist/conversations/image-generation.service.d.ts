import { AttachmentPayload } from '../attachments/attachments.types';
export declare class ImageGenerationException extends Error {
    constructor(message?: string);
}
export type ImageGenerationResult = {
    assistant_text: string;
    provider: string;
    model: string;
    size: string;
    quality: string;
    operation: 'generate' | 'edit';
    attachments: AttachmentPayload[];
    revised_prompt: string | null;
};
export type ImageIntent = 'generate' | 'edit' | 'chat';
export declare function detectImageIntent(content: string, attachments: AttachmentPayload[]): ImageIntent;
export declare class ImageGenerationService {
    private resolveApiKey;
    private resolveModel;
    private resolveSize;
    private resolveQuality;
    private resolveStorageRoot;
    private resolvePublicBaseUrl;
    private resolveInternalBaseUrl;
    generateForConversation(conversationId: number, prompt: string): Promise<ImageGenerationResult>;
    editForConversation(conversationId: number, prompt: string, attachments: AttachmentPayload[]): Promise<ImageGenerationResult>;
    private storeBase64Image;
}
