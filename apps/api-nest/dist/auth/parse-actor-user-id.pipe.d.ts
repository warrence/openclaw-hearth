import { PipeTransform } from '@nestjs/common';
export declare class ParseActorUserIdPipe implements PipeTransform<unknown, number> {
    transform(value: unknown): number;
}
