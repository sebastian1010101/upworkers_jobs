import { Injectable } from '@nestjs/common';
import { Prisma, ProposalDraft } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProposalDraftRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByJobId(jobId: string): Promise<ProposalDraft | null> {
    return this.prisma.proposalDraft.findUnique({ where: { jobId } });
  }

  create(data: Prisma.ProposalDraftCreateInput): Promise<ProposalDraft> {
    return this.prisma.proposalDraft.create({ data });
  }

  approve(jobId: string): Promise<ProposalDraft> {
    return this.prisma.proposalDraft.update({
      where: { jobId },
      data: { approved: true, approvedAt: new Date() },
    });
  }
}
