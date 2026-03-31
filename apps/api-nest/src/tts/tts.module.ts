import { Module } from '@nestjs/common';
import { TtsController } from './tts.controller';

@Module({
  controllers: [TtsController],
})
export class TtsModule {}
