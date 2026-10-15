import { EventEmitter } from 'events';

/**
 * Typed event map for the application.
 * Using a typed emitter prevents typos in event names and enforces payload types.
 * Extended in Phase 5 when URL ingestion needs background processing.
 */
export interface AppEvents {
  'item.created': [itemId: string];
}

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof AppEvents>(event: K, ...args: AppEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof AppEvents>(
    event: K,
    listener: (...args: AppEvents[K]) => void
  ): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  once<K extends keyof AppEvents>(
    event: K,
    listener: (...args: AppEvents[K]) => void
  ): this {
    return super.once(event, listener as (...args: unknown[]) => void);
  }
}

export const appEvents = new TypedEventEmitter();
