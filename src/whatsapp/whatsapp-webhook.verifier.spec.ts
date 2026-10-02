import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { WhatsAppWebhookVerifier } from './whatsapp-webhook.verifier';

const config = {
  get: (key: string) => key === 'WHATSAPP_APP_SECRET' ? 'app-secret' : 'verify-token',
} as unknown as ConfigService;

describe('WhatsAppWebhookVerifier', () => {
  const verifier = new WhatsAppWebhookVerifier(config);

  it('returns Meta challenge only for the configured verification token', () => {
    expect(verifier.verifySubscription('subscribe', 'verify-token', '12345')).toBe('12345');
    expect(() => verifier.verifySubscription('subscribe', 'wrong', '12345')).toThrow('Invalid WhatsApp webhook verification request');
  });

  it('validates X-Hub-Signature-256 against the exact raw body', () => {
    const body = Buffer.from('{"object":"whatsapp_business_account"}');
    const signature = `sha256=${createHmac('sha256', 'app-secret').update(body).digest('hex')}`;

    expect(() => verifier.verifySignature(body, signature)).not.toThrow();
    expect(() => verifier.verifySignature(Buffer.from('{}'), signature)).toThrow('Invalid WhatsApp webhook signature');
    expect(() => verifier.verifySignature(body, undefined)).toThrow('Invalid WhatsApp webhook signature');
  });
});
