export type AttachmentsConfig = {
    storageRoot: string;
    publicBaseUrl: string;
    internalBaseUrl: string;
    tokenSecret: string;
    tokenTtlSeconds: number;
};
export declare const attachmentsConfig: (() => AttachmentsConfig) & import("@nestjs/config").ConfigFactoryKeyHost<AttachmentsConfig>;
