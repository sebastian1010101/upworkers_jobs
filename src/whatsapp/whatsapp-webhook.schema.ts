import { z } from 'zod';

const messageSchema = z.object({
  from: z.string().min(1),
  id: z.string().min(1),
  timestamp: z.string().optional(),
  type: z.string(),
  text: z.object({ body: z.string() }).optional(),
  context: z.object({ id: z.string().min(1) }).passthrough().optional(),
}).passthrough();

export const whatsAppWebhookSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(z.object({
    changes: z.array(z.object({
      field: z.string(),
      value: z.object({
        messaging_product: z.string().optional(),
        messages: z.array(messageSchema).optional(),
      }).passthrough(),
    }).passthrough()),
  }).passthrough()),
}).passthrough();

export type WhatsAppInboundPayload = z.infer<typeof whatsAppWebhookSchema>;
export type WhatsAppInboundPayloadMessage = z.infer<typeof messageSchema>;

export function extractTextMessages(payload: WhatsAppInboundPayload): WhatsAppInboundPayloadMessage[] {
  return payload.entry.flatMap((entry) => entry.changes.flatMap((change) => {
    if (change.field !== 'messages') return [];
    return (change.value.messages ?? []).filter((message) => message.type === 'text' && message.text);
  }));
}
