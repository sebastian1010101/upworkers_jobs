import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { WhatsAppTemplateMessage } from './whatsapp-message';
import { retry } from '../common/retry';

const successSchema = z.object({
  messages: z.array(z.object({ id: z.string().min(1) })).min(1),
}).passthrough();

const errorSchema = z.object({
  error: z.object({
    message: z.string().optional(),
    code: z.number().optional(),
    type: z.string().optional(),
  }),
}).passthrough();

export class WhatsAppApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'WhatsAppApiError';
  }
}

@Injectable()
export class WhatsAppClient {
  private readonly logger = new Logger(WhatsAppClient.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.config.get<string>('WHATSAPP_ACCESS_TOKEN')
      && this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID')
      && this.config.get<string>('WHATSAPP_RECIPIENT_PHONE_NUMBER'),
    );
  }

  async sendTemplate(message: WhatsAppTemplateMessage): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('WhatsApp notifications are not configured');
    }

    return this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: this.config.getOrThrow<string>('WHATSAPP_RECIPIENT_PHONE_NUMBER'),
      type: 'template',
      template: {
        name: message.templateName,
        language: { code: message.languageCode },
        components: [{
          type: 'body',
          parameters: message.parameters.map((text) => ({ type: 'text', text })),
        }],
      },
    });
  }

  async sendText(to: string, body: string, replyToMessageId?: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('WhatsApp notifications are not configured');
    }
    return this.send({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: body.slice(0, 4096), preview_url: false },
      ...(replyToMessageId ? { context: { message_id: replyToMessageId } } : {}),
    });
  }

  private async send(payload: Record<string, unknown>): Promise<string> {
    const version = this.config.getOrThrow<string>('WHATSAPP_GRAPH_API_VERSION');
    const phoneNumberId = this.config.getOrThrow<string>('WHATSAPP_PHONE_NUMBER_ID');
    return retry(async () => {
      let response: Response;
      try {
        response = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.getOrThrow<string>('WHATSAPP_ACCESS_TOKEN')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(this.config.getOrThrow<number>('WHATSAPP_TIMEOUT_MS')),
        });
      } catch {
        throw new WhatsAppApiError('NETWORK_ERROR', 'WhatsApp API request timed out or failed');
      }

      const responsePayload: unknown = await response.json().catch(() => ({}));
      if (!response.ok) {
        const parsed = errorSchema.safeParse(responsePayload);
        const providerCode = parsed.success && parsed.data.error.code !== undefined
          ? String(parsed.data.error.code)
          : `HTTP_${response.status}`;
        const messageText = parsed.success
          ? parsed.data.error.message ?? 'WhatsApp API request failed'
          : 'WhatsApp API request failed';
        throw new WhatsAppApiError(providerCode, messageText, response.status === 429);
      }

      const parsed = successSchema.safeParse(responsePayload);
      if (!parsed.success) {
        throw new WhatsAppApiError('INVALID_RESPONSE', 'WhatsApp API returned an invalid response');
      }
      return parsed.data.messages[0].id;
    }, {
      attempts: this.config.get<number>('EXTERNAL_RETRY_ATTEMPTS') ?? 3,
      baseDelayMs: this.config.get<number>('EXTERNAL_RETRY_BASE_DELAY_MS') ?? 250,
      shouldRetry: (error) => error instanceof WhatsAppApiError && error.retryable,
      onRetry: ({ attempt, delayMs }) => this.logger.warn({
        event: 'external_retry', provider: 'whatsapp', attempt, delayMs,
      }),
    });
  }
}
