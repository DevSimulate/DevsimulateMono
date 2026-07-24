import { EventEmitter } from "events";

/**
 * In-process event bus for review completion notifications.
 * The BullMQ worker and the SSE HTTP handler share this emitter
 * because they run in the same Railway process.
 *
 * Emits:
 *  - "reviewed" with submissionId when a review is saved.
 *  - "failed"   with submissionId when review gave up after every retry, so the
 *               client can say "delayed, you'll be emailed" instead of spinning.
 */
export const reviewEvents = new EventEmitter();
reviewEvents.setMaxListeners(200);
