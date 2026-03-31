import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppController } from './app.controller';
import { appConfig } from './config/app.config';
import { authConfig } from './config/auth.config';
import { attachmentsConfig } from './config/attachments.config';
import { databaseConfig } from './config/database.config';
import { ConversationsModule } from './conversations/conversations.module';
import { envValidationSchema } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { openClawConfig } from './config/openclaw.config';
import { AuthModule } from './auth/auth.module';
import { ProfilesModule } from './profiles/profiles.module';
import { PushModule } from './push/push.module';
import { EventsModule } from './events/events.module';
import { SettingsModule } from './settings/settings.module';
import { TtsModule } from './tts/tts.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [
        appConfig,
        authConfig,
        attachmentsConfig,
        databaseConfig,
        openClawConfig,
      ],
      validationSchema: envValidationSchema,
    }),
    DatabaseModule,
    AuthModule,
    ProfilesModule,
    PushModule,
    SettingsModule,
    ConversationsModule,
    RemindersModule,
    EventsModule,
    TtsModule,
    AttachmentsModule,
    HealthModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
