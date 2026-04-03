import { EventBusService } from './event-bus.service';
export declare class EventsController {
    private readonly eventBus;
    constructor(eventBus: EventBusService);
    streamEvents(userId: number, res: any): void;
}
