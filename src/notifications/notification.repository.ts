import { Injectable } from '@nestjs/common';
import { Notification, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findWhatsApp(jobId: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({
      where: { jobId_channel: { jobId, channel: 'WHATSAPP' } },
    });
  }

  createPending(jobId: string): Promise<Notification> {
    return this.prisma.notification.create({
      data: { job: { connect: { id: jobId } }, channel: 'WHATSAPP' },
    });
  }

  retry(id: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: {
        status: 'PENDING',
        attemptCount: { increment: 1 },
        errorCode: null,
        errorMessage: null,
      },
    });
  }

  markSent(id: string, externalMessageId: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: { status: 'SENT', externalMessageId, sentAt: new Date() },
    });
  }

  markFailed(id: string, errorCode: string, errorMessage: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id },
      data: { status: 'FAILED', errorCode, errorMessage: errorMessage.slice(0, 500) },
    });
  }
}
