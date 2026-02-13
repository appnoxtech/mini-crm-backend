import { EventEmitter } from 'events';

export interface DomainEvent {
  type: string;
  tenantId: string;
  payload: Record<string, any>;
  timestamp: Date;
  userId?: number;
}

export interface DealCreatedEvent extends DomainEvent {
  type: 'deal.created';
  payload: {
    dealId: number;
    title: string;
    value: number | null;
    currency: string | null;
    pipelineId: number;
    stageId: number;
    stageName?: string;
    personName?: string;
    organizationName?: string;
  };
}

export interface DealUpdatedEvent extends DomainEvent {
  type: 'deal.updated';
  payload: {
    dealId: number;
    title: string;
    changes: Record<string, { from: any; to: any }>;
  };
}

export interface DealStageChangedEvent extends DomainEvent {
  type: 'deal.stage_changed';
  payload: {
    dealId: number;
    title: string;
    fromStage: string;
    toStage: string;
    value: number | null;
  };
}

export interface DealWonEvent extends DomainEvent {
  type: 'deal.won';
  payload: {
    dealId: number;
    title: string;
    value: number | null;
    currency: string | null;
  };
}

export interface DealLostEvent extends DomainEvent {
  type: 'deal.lost';
  payload: {
    dealId: number;
    title: string;
    value: number | null;
    lostReason?: string;
  };
}

export type CRMEvent = 
  | DealCreatedEvent 
  | DealUpdatedEvent 
  | DealStageChangedEvent 
  | DealWonEvent 
  | DealLostEvent;

class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(50);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public publish<T extends DomainEvent>(event: T): void {
    console.log(`[EventBus] Publishing event: ${event.type}`, {
      tenantId: event.tenantId,
      timestamp: event.timestamp,
    });
    this.emit(event.type, event);
    this.emit('*', event); // Wildcard listener for all events
  }

  public subscribe<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => void | Promise<void>
  ): void {
    this.on(eventType, async (event: T) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[EventBus] Error handling event ${eventType}:`, error);
      }
    });
  }

  public subscribeOnce<T extends DomainEvent>(
    eventType: string,
    handler: (event: T) => void | Promise<void>
  ): void {
    this.once(eventType, async (event: T) => {
      try {
        await handler(event);
      } catch (error) {
        console.error(`[EventBus] Error handling event ${eventType}:`, error);
      }
    });
  }
}

export const eventBus = EventBus.getInstance();
