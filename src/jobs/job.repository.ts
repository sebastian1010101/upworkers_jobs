import { Injectable } from '@nestjs/common';
import { Job, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.JobCreateInput): Promise<Job> {
    return this.prisma.job.create({ data });
  }

  findById(id: string): Promise<Job | null> {
    return this.prisma.job.findUnique({ where: { id } });
  }

  list(): Promise<Job[]> {
    return this.prisma.job.findMany({
      where: { OR: [{ source: 'MANUAL' }, { expiresAt: { gt: new Date() } }] },
      orderBy: { discoveredAt: 'desc' },
      take: 50,
    });
  }

  deleteExpiredUpwork(): Promise<Prisma.BatchPayload> {
    return this.prisma.job.deleteMany({
      where: { source: 'UPWORK', expiresAt: { lte: new Date() } },
    });
  }

  updateStatus(id: string, status: 'NEW' | 'IGNORED' | 'SAVED'): Promise<Job> {
    return this.prisma.job.update({ where: { id }, data: { status } });
  }
}
