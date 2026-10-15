import { ProcessingPipeline } from '../../domain/interfaces';
import { appEvents } from '../../lib/events';
import { logger } from '../../lib/logger';

/**
 * Observer pattern: listens for 'item.created' events and runs the processing
 * pipeline in the background. Errors are caught and logged — a failure here
 * marks the item as 'failed' inside the pipeline, so the API process stays up.
 *
 * Why in-process event-driven rather than a separate worker:
 *   Simplicity for a single-user app. No queue infrastructure needed.
 *   Trade-off: if the process crashes mid-pipeline, the item stays 'pending'
 *   forever. A durable job queue (e.g. BullMQ) would solve this at scale.
 */
export class ItemProcessor {
  private readonly pipeline: ProcessingPipeline;

  constructor(pipeline: ProcessingPipeline) {
    this.pipeline = pipeline;
  }

  /** Register the event listener. Called once from the composition root. */
  start(): void {
    appEvents.on('item.created', (itemId) => {
      // Run async without awaiting — background fire-and-forget
      this.pipeline.run(itemId).catch((err) => {
        logger.error({ err, itemId }, 'ItemProcessor: unhandled pipeline error');
      });
    });

    logger.info('ItemProcessor: listening for item.created events');
  }
}
