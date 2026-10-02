import { PrismaService } from '../prisma/prisma.service';
import { MonitoringService } from './monitoring.service';

describe('MonitoringService', () => {
  it('returns aggregate operational counters without record contents', async () => {
    const prisma = {
      job: { groupBy: jest.fn().mockResolvedValue([
        { status: 'NEW', _count: { _all: 3 } },
        { status: 'IGNORED', _count: { _all: 2 } },
      ]) },
      notification: { groupBy: jest.fn().mockResolvedValue([
        { status: 'SENT', _count: { _all: 2 } },
        { status: 'FAILED', _count: { _all: 1 } },
      ]) },
      whatsAppInboundMessage: { groupBy: jest.fn().mockResolvedValue([
        { status: 'PROCESSED', _count: { _all: 4 } },
      ]) },
      jobAnalysis: { count: jest.fn().mockResolvedValue(3) },
      proposalDraft: { count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1) },
    } as unknown as PrismaService;
    const service = new MonitoringService(prisma);

    await expect(service.metrics()).resolves.toMatchObject({
      status: 'ok',
      jobs: { total: 5, new: 3, ignored: 2, saved: 0 },
      processing: { analyses: 3, proposalDrafts: 2, approvedProposalDrafts: 1 },
      notifications: { pending: 0, sent: 2, failed: 1 },
      webhooks: { pending: 0, processed: 4, failed: 0 },
    });
  });
});
