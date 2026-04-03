export declare class OpenClawConfigWriterService {
    private readonly logger;
    read(): Record<string, unknown>;
    patch(patch: Record<string, unknown>): void;
    get<T = unknown>(path: string): T | undefined;
}
