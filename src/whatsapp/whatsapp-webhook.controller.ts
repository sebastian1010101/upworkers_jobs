import { Body, Controller, Get, Header, Headers, HttpCode, Post, Query, RawBodyRequest, Req } from '@nestjs/common';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';
import { WhatsAppWebhookVerifier } from './whatsapp-webhook.verifier';

@Controller('webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    private readonly verifier: WhatsAppWebhookVerifier,
    private readonly webhook: WhatsAppWebhookService,
  ) {}

  @Get()
  @Header('Content-Type', 'text/plain')
  verify(
    @Query('hub.mode') mode?: string,
    @Query('hub.verify_token') token?: string,
    @Query('hub.challenge') challenge?: string,
  ) {
    return this.verifier.verifySubscription(mode, token, challenge);
  }

  @Post()
  @HttpCode(200)
  receive(
    @Req() request: RawBodyRequest<object>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() body: unknown,
  ) {
    this.verifier.verifySignature(request.rawBody, signature);
    return this.webhook.handle(body);
  }
}
