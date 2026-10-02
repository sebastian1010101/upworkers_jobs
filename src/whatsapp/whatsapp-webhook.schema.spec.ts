import { extractTextMessages, whatsAppWebhookSchema } from './whatsapp-webhook.schema';

describe('WhatsApp webhook schema', () => {
  it('extracts received text messages from the official nested payload', () => {
    const parsed = whatsAppWebhookSchema.parse({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          messages: [{
            from: '5511999999999',
            id: 'wamid.inbound',
            timestamp: '1603059201',
            type: 'text',
            text: { body: '1' },
            context: { id: 'wamid.outbound' },
          }],
        },
      }] }],
    });

    expect(extractTextMessages(parsed)).toEqual([
      expect.objectContaining({ id: 'wamid.inbound', from: '5511999999999', text: { body: '1' } }),
    ]);
  });

  it('accepts status-only events without treating them as inbound messages', () => {
    const parsed = whatsAppWebhookSchema.parse({
      object: 'whatsapp_business_account',
      entry: [{ changes: [{ field: 'messages', value: { statuses: [{ status: 'delivered' }] } }] }],
    });
    expect(extractTextMessages(parsed)).toEqual([]);
  });
});
