import { ConfigService } from '@nestjs/config';
export declare class TtsController {
    private readonly configService;
    constructor(configService: ConfigService);
    speak(body: {
        text: string;
    }, res: any): Promise<void>;
}
