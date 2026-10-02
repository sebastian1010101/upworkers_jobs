import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  constructor(private readonly prisma: PrismaService) {}

  async metrics() {
    try {
      const [jobs, notifications, webhooks, analyses, proposalDrafts, approvedProposalDrafts] = await Promise.all([
        this.prisma.job.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.notification.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.whatsAppInboundMessage.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.jobAnalysis.count(),
        this.prisma.proposalDraft.count(),
        this.prisma.proposalDraft.count({ where: { approved: true } }),
      ]);

      const jobCounts = countByStatus(jobs);
      const notificationCounts = countByStatus(notifications);
      const webhookCounts = countByStatus(webhooks);
      return {
        status: 'ok',
        generatedAt: new Date().toISOString(),
        uptimeSeconds: Math.floor(process.uptime()),
        jobs: {
          total: sum(jobCounts),
          new: jobCounts.NEW ?? 0,
          ignored: jobCounts.IGNORED ?? 0,
          saved: jobCounts.SAVED ?? 0,
        },
        processing: { analyses, proposalDrafts, approvedProposalDrafts },
        notifications: {
          pending: notificationCounts.PENDING ?? 0,
          sent: notificationCounts.SENT ?? 0,
          failed: notificationCounts.FAILED ?? 0,
        },
        webhooks: {
          pending: webhookCounts.RECEIVED ?? 0,
          processed: webhookCounts.PROCESSED ?? 0,
          failed: webhookCounts.FAILED ?? 0,
        },
      };
    } catch {
      throw new ServiceUnavailableException('Operational metrics are unavailable');
    }
  }
}

function countByStatus(rows: Array<{ status: string; _count: { _all: number } }>): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}

function sum(counts: Record<string, number>): number {
  return Object.values(counts).reduce((total, value) => total + value, 0);
}
