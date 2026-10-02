import { ForbiddenException, Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

@Injectable()
export class WhatsAppWebhookVerifier {
  constructor(private readonly config: ConfigService) {}

  verifySubscription(mode: string | undefined, token: string | undefined, challenge: string | undefined): string {
    const expected = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
    if (!expected) throw new ServiceUnavailableException('WhatsApp webhook is not configured');
    if (mode !== 'subscribe' || !token || !challenge || !safeEqual(token, expected)) {
      throw new ForbiddenException('Invalid WhatsApp webhook verification request');
    }
    return challenge;
  }

  verifySignature(rawBody: Buffer | undefined, signature: string | undefined): void {
    const secret = this.config.get<string>('WHATSAPP_APP_SECRET');
    if (!secret) throw new ServiceUnavailableException('WhatsApp webhook is not configured');
    if (!rawBody || !signature?.startsWith('sha256=')) {
      throw new UnauthorizedException('Invalid WhatsApp webhook signature');
    }
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    if (!safeEqual(signature, expected)) {
      throw new UnauthorizedException('Invalid WhatsApp webhook signature');
    }
  }
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}
