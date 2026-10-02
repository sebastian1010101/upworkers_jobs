import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { JobModule } from '../jobs/job.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProposalModule } from '../proposals/proposal.module';
import { WhatsAppClient } from '../whatsapp/whatsapp.client';
import { WhatsAppWebhookController } from '../whatsapp/whatsapp-webhook.controller';
import { WhatsAppWebhookRepository } from '../whatsapp/whatsapp-webhook.repository';
import { WhatsAppWebhookService } from '../whatsapp/whatsapp-webhook.service';
import { WhatsAppWebhookVerifier } from '../whatsapp/whatsapp-webhook.verifier';
import { NotificationController } from './notification.controller';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

@Module({
  imports: [AiModule, JobModule, PrismaModule, ProposalModule],
  controllers: [NotificationController, WhatsAppWebhookController],
  providers: [
    NotificationRepository,
    NotificationService,
    WhatsAppClient,
    WhatsAppWebhookRepository,
    WhatsAppWebhookService,
    WhatsAppWebhookVerifier,
  ],
  exports: [NotificationService],
})
export class NotificationsModule {}
