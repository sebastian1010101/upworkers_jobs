import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { JobAnalysis, Prisma } from '@prisma/client';
import { JobService } from '../jobs/job.service';
import { JobAnalysisRepository } from './job-analysis.repository';
import { OpenAiAnalysisClient } from './openai-analysis.client';
import { JobScoringService } from '../matching/job-scoring.service';

@Injectable()
export class JobAnalyzerService {
  constructor(
    private readonly jobs: JobService,
    private readonly analyses: JobAnalysisRepository,
    private readonly ai: OpenAiAnalysisClient,
    private readonly scoring: JobScoringService,
  ) {}

  isConfigured(): boolean {
    return this.ai.isConfigured();
  }

  async get(jobId: string): Promise<JobAnalysis> {
    const analysis = await this.analyses.findByJobId(jobId);
    if (!analysis) throw new NotFoundException('Job analysis not found');
    return analysis;
  }

  async analyze(jobId: string): Promise<JobAnalysis> {
    const existing = await this.analyses.findByJobId(jobId);
    if (existing) return existing;

    const job = await this.jobs.getById(jobId);
    if (job.status === 'IGNORED') {
      throw new BadRequestException('Ignored jobs cannot be analyzed');
    }

    const result = await this.ai.analyze(job);
    const score = this.scoring.calculate(job, {
      llmScore: result.score,
      llmCompetitionScore: result.competition,
    });
    try {
      return await this.analyses.create({
        job: { connect: { id: job.id } },
        score: score.score,
        llmScore: score.llmScore,
        ruleScore: score.ruleScore,
        clientScore: score.clientScore,
        technicalScore: result.technicalMatch,
        experienceScore: result.experienceMatch,
        portfolioScore: result.portfolioMatch,
        communicationScore: result.englishRequirement,
        competitionScore: score.competitionScore,
        llmCompetitionScore: score.llmCompetitionScore,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        recommendation: result.recommendation,
        shouldNotify: score.shouldNotify,
        model: this.ai.getModel(),
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.analyses.findByJobId(jobId);
        if (concurrent) return concurrent;
      }
      throw error;
    }
  }

  async rescore(jobId: string): Promise<JobAnalysis> {
    const [job, analysis] = await Promise.all([
      this.jobs.getById(jobId),
      this.analyses.findByJobId(jobId),
    ]);
    if (!analysis) throw new NotFoundException('Job analysis not found');

    const score = this.scoring.calculate(job, {
      llmScore: Number(analysis.llmScore),
      llmCompetitionScore: Number(analysis.llmCompetitionScore),
    });
    return this.analyses.updateScoring(jobId, {
      score: score.score,
      ruleScore: score.ruleScore,
      clientScore: score.clientScore,
      competitionScore: score.competitionScore,
      shouldNotify: score.shouldNotify,
      scoredAt: new Date(),
    });
  }
}
