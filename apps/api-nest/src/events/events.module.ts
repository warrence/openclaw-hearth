import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EventBusService } from './event-bus.service';
import { EventsController } from './events.controller';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [EventsController],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventsModule {}
