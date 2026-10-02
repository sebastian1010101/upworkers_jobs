import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProposalDraft } from '@prisma/client';
import { JobAnalyzerService } from '../ai/job-analyzer.service';
import { JobService } from '../jobs/job.service';
import { OpenAiProposalClient } from './openai-proposal.client';
import { ProposalDraftRepository } from './proposal-draft.repository';

@Injectable()
export class ProposalService {
  constructor(
    private readonly jobs: JobService,
    private readonly analyzer: JobAnalyzerService,
    private readonly drafts: ProposalDraftRepository,
    private readonly ai: OpenAiProposalClient,
  ) {}

  async get(jobId: string): Promise<ProposalDraft> {
    await this.jobs.getById(jobId);
    const draft = await this.drafts.findByJobId(jobId);
    if (!draft) throw new NotFoundException('Proposal draft not found');
    return draft;
  }

  async generate(jobId: string): Promise<ProposalDraft> {
    const existing = await this.drafts.findByJobId(jobId);
    if (existing) return existing;

    const job = await this.jobs.getById(jobId);
    if (job.status === 'IGNORED') {
      throw new BadRequestException('Ignored jobs cannot have proposal drafts');
    }

    const analysis = await this.analyzer.analyze(jobId);
    const output = await this.ai.generate(job, analysis);
    try {
      return await this.drafts.create({
        job: { connect: { id: job.id } },
        content: output.content.trim(),
        model: this.ai.getModel(),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.drafts.findByJobId(jobId);
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  async approve(jobId: string): Promise<ProposalDraft> {
    await this.jobs.getById(jobId);
    const draft = await this.drafts.findByJobId(jobId);
    if (!draft) throw new NotFoundException('Proposal draft not found');
    if (draft.approved) return draft;
    return this.drafts.approve(jobId);
  }
}
