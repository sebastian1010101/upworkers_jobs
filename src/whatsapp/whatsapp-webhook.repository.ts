import { Injectable } from '@nestjs/common';
import { Notification, Prisma, WhatsAppAction, WhatsAppInboundMessage } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface Reservation {
  message: WhatsAppInboundMessage;
  duplicate: boolean;
}

@Injectable()
export class WhatsAppWebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async reserve(externalMessageId: string, sender: string, text: string, action: WhatsAppAction): Promise<Reservation> {
    const existing = await this.prisma.whatsAppInboundMessage.findUnique({ where: { externalMessageId } });
    if (existing) {
      const stale = existing.status === 'RECEIVED' && Date.now() - existing.updatedAt.getTime() >= 5 * 60 * 1000;
      if (existing.status !== 'FAILED' && !stale) return { message: existing, duplicate: true };
      return {
        message: await this.prisma.whatsAppInboundMessage.update({
          where: { id: existing.id },
          data: { status: 'RECEIVED', attemptCount: { increment: 1 }, errorMessage: null },
        }),
        duplicate: false,
      };
    }

    try {
      return {
        message: await this.prisma.whatsAppInboundMessage.create({
          data: { externalMessageId, sender, text, action },
        }),
        duplicate: false,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.prisma.whatsAppInboundMessage.findUniqueOrThrow({ where: { externalMessageId } });
        return { message: concurrent, duplicate: true };
      }
      throw error;
    }
  }

  findNotificationByMessageId(externalMessageId: string): Promise<Notification | null> {
    return this.prisma.notification.findFirst({
      where: { channel: 'WHATSAPP', status: 'SENT', externalMessageId },
    });
  }

  findLatestNotification(since: Date): Promise<Notification | null> {
    return this.prisma.notification.findFirst({
      where: { channel: 'WHATSAPP', status: 'SENT', sentAt: { gte: since } },
      orderBy: { sentAt: 'desc' },
    });
  }

  markProcessed(id: string, jobId: string | null): Promise<WhatsAppInboundMessage> {
    return this.prisma.whatsAppInboundMessage.update({
      where: { id },
      data: {
        status: 'PROCESSED',
        processedAt: new Date(),
        ...(jobId ? { job: { connect: { id: jobId } } } : {}),
      },
    });
  }

  markFailed(id: string, error: string): Promise<WhatsAppInboundMessage> {
    return this.prisma.whatsAppInboundMessage.update({
      where: { id },
      data: { status: 'FAILED', errorMessage: error.slice(0, 500) },
    });
  }
}
