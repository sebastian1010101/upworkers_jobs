import { Injectable } from '@nestjs/common';
import { JobAnalysis, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobAnalysisRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByJobId(jobId: string): Promise<JobAnalysis | null> {
    return this.prisma.jobAnalysis.findUnique({ where: { jobId } });
  }

  create(data: Prisma.JobAnalysisCreateInput): Promise<JobAnalysis> {
    return this.prisma.jobAnalysis.create({ data });
  }

  updateScoring(jobId: string, data: Prisma.JobAnalysisUpdateInput): Promise<JobAnalysis> {
    return this.prisma.jobAnalysis.update({ where: { jobId }, data });
  }
}
