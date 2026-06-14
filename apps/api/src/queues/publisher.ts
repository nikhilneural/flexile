import type { Env } from "@/env";
import { type MessageType, type PayloadForType, messageSchemas, getQueueForType, QUEUES } from "./registry";

/**
 * Type-safe queue publisher.
 * Validates message payloads against Zod schemas before enqueuing.
 *
 * Usage:
 *   await publish(env, "invoice.pay", { invoiceId: "inv_123" });
 *   await publish(env, "email.company-admin-digest", {});
 */
export async function publish<T extends MessageType>(env: Env, type: T, payload: PayloadForType<T>): Promise<void> {
  const schema = messageSchemas[type];
  const validated = schema.parse(payload);

  const message = { type, payload: validated };
  const queueName = getQueueForType(type);
  const queue = getQueue(env, queueName);

  await queue.send(message);
  console.info(`[queue-publisher] Enqueued message: ${type}`);
}

/**
 * Publish multiple messages to the same queue in a batch.
 * All messages must target the same queue.
 */
export async function publishBatch<T extends MessageType>(
  env: Env,
  messages: Array<{ type: T; payload: PayloadForType<T> }>,
): Promise<void> {
  if (messages.length === 0) return;

  // Group by target queue
  const byQueue = new Map<string, Array<{ body: { type: string; payload: unknown } }>>();

  for (const msg of messages) {
    const schema = messageSchemas[msg.type];
    const validated = schema.parse(msg.payload);
    const queueName = getQueueForType(msg.type);

    if (!byQueue.has(queueName)) {
      byQueue.set(queueName, []);
    }
    byQueue.get(queueName)!.push({ body: { type: msg.type, payload: validated } });
  }

  // Send each batch
  for (const [queueName, batch] of byQueue) {
    const queue = getQueue(env, queueName as keyof typeof QUEUES extends never ? string : string);
    await queue.sendBatch(batch);
    console.info(`[queue-publisher] Enqueued batch of ${batch.length} messages to ${queueName}`);
  }
}

function getQueue(env: Env, queueName: string): Queue {
  switch (queueName) {
    case QUEUES.EMAILS:
      return env.QUEUE_EMAILS;
    case QUEUES.JOBS:
      return env.QUEUE_JOBS;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }
}
