import { ConfigService } from '@nestjs/config';
export declare class AppController {
    private readonly configService;
    constructor(configService: ConfigService);
    getInfo(): {
        name: string;
        status: string;
        docs: string;
    };
    getApiInfo(): {
        name: string;
        status: string;
        docs: string;
    };
    private buildInfo;
}
