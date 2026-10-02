import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { JobAnalyzerService } from '../ai/job-analyzer.service';
import { JobService } from '../jobs/job.service';
import { WhatsAppApiError, WhatsAppClient } from '../whatsapp/whatsapp.client';
import { buildJobAlertParameters } from '../whatsapp/whatsapp-message';
import { NotificationRepository } from './notification.repository';

@Injectable()
export class NotificationService {
  constructor(
    private readonly jobs: JobService,
    private readonly analyzer: JobAnalyzerService,
    private readonly repository: NotificationRepository,
    private readonly whatsapp: WhatsAppClient,
    private readonly config: ConfigService,
  ) {}

  isConfigured(): boolean {
    return this.whatsapp.isConfigured();
  }

  async getWhatsApp(jobId: string): Promise<Notification> {
    await this.jobs.getById(jobId);
    const notification = await this.repository.findWhatsApp(jobId);
    if (!notification) throw new NotFoundException('WhatsApp notification not found');
    return notification;
  }

  async sendWhatsApp(jobId: string): Promise<Notification> {
    if (!this.whatsapp.isConfigured()) {
      throw new ServiceUnavailableException('WhatsApp notifications are not configured');
    }
    const [job, analysis] = await Promise.all([
      this.jobs.getById(jobId),
      this.analyzer.get(jobId),
    ]);
    if (!analysis.shouldNotify) {
      throw new BadRequestException('This job does not meet the notification threshold');
    }

    let notification = await this.repository.findWhatsApp(jobId);
    if (notification?.status === 'SENT') return notification;
    if (notification?.status === 'PENDING' && Date.now() - notification.updatedAt.getTime() < 5 * 60 * 1000) {
      throw new ConflictException('A WhatsApp notification is already being sent');
    }

    if (notification) {
      notification = await this.repository.retry(notification.id);
    } else {
      try {
        notification = await this.repository.createPending(jobId);
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          throw new ConflictException('A WhatsApp notification is already being sent');
        }
        throw error;
      }
    }

    try {
      const externalMessageId = await this.whatsapp.sendTemplate({
        templateName: this.configuredTemplateName(),
        languageCode: this.configuredLanguage(),
        parameters: buildJobAlertParameters(job, analysis),
      });
      return await this.repository.markSent(notification.id, externalMessageId);
    } catch (error) {
      const code = error instanceof WhatsAppApiError ? error.code : 'SEND_FAILED';
      const message = error instanceof Error ? error.message : 'Unknown WhatsApp error';
      await this.repository.markFailed(notification.id, code, message);
      throw error;
    }
  }

  private configuredTemplateName(): string {
    return this.config.getOrThrow<string>('WHATSAPP_TEMPLATE_NAME');
  }

  private configuredLanguage(): string {
    return this.config.getOrThrow<string>('WHATSAPP_TEMPLATE_LANGUAGE');
  }
}
