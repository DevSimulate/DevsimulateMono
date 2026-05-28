import { EventEmitter } from "events";

/**
 * In-process event bus for review completion notifications.
 * The BullMQ worker and the SSE HTTP handler share this emitter
 * because they run in the same Railway process.
 *
 * Emits: "reviewed" with submissionId string when a review is saved.
 */
export const reviewEvents = new EventEmitter();
reviewEvents.setMaxListeners(200);
