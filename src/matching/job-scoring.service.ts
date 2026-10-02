import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from '@prisma/client';
import { JobFilterService } from './job-filter.service';

export interface ScoringInput {
  llmScore: number;
  llmCompetitionScore: number;
}

export interface ScoringResult {
  score: number;
  llmScore: number;
  ruleScore: number;
  clientScore: number;
  competitionScore: number;
  llmCompetitionScore: number;
  shouldNotify: boolean;
}

const WEIGHTS = {
  llm: 0.55,
  rules: 0.15,
  client: 0.15,
  competition: 0.15,
} as const;

@Injectable()
export class JobScoringService {
  constructor(
    private readonly filters: JobFilterService,
    private readonly config: ConfigService,
  ) {}

  calculate(job: Job, input: ScoringInput): ScoringResult {
    const llmScore = normalizeScore(input.llmScore);
    const llmCompetitionScore = normalizeScore(input.llmCompetitionScore);
    const ruleScore = this.ruleScore(job);
    const clientScore = calculateClientScore(job);
    const competitionScore = calculateCompetitionScore(job.proposalCount, llmCompetitionScore);
    const score = roundScore(
      llmScore * WEIGHTS.llm
      + ruleScore * WEIGHTS.rules
      + clientScore * WEIGHTS.client
      + competitionScore * WEIGHTS.competition,
    );

    return {
      score,
      llmScore,
      ruleScore,
      clientScore,
      competitionScore,
      llmCompetitionScore,
      shouldNotify: score >= this.config.getOrThrow<number>('JOB_NOTIFY_SCORE_THRESHOLD'),
    };
  }

  private ruleScore(job: Job): number {
    const filter = this.filters.evaluate({
      title: job.title,
      description: job.description,
      skills: job.skills,
      budgetType: job.budgetType,
      ...(job.budgetMin ? { budgetMin: job.budgetMin.toString() } : {}),
      ...(job.budgetMax ? { budgetMax: job.budgetMax.toString() } : {}),
      ...(job.hourlyMin ? { hourlyMin: job.hourlyMin.toString() } : {}),
      ...(job.hourlyMax ? { hourlyMax: job.hourlyMax.toString() } : {}),
    });
    const keywordScore = Math.min(10, 4 + filter.matchedKeywords.length * 0.75);
    return roundScore(keywordScore * 0.7 + calculateBudgetScore(job) * 0.3);
  }
}

function calculateBudgetScore(job: Job): number {
  if (job.budgetType === 'FIXED') {
    const amount = numeric(job.budgetMax ?? job.budgetMin);
    if (amount === undefined) return 5;
    if (amount >= 1000) return 10;
    if (amount >= 500) return 9;
    if (amount >= 300) return 8;
    if (amount >= 100) return 6.5;
    return 3;
  }
  if (job.budgetType === 'HOURLY') {
    const amount = numeric(job.hourlyMax ?? job.hourlyMin);
    if (amount === undefined) return 5;
    if (amount >= 50) return 10;
    if (amount >= 30) return 9;
    if (amount >= 20) return 8;
    if (amount >= 10) return 6.5;
    return 3;
  }
  return 5;
}

function calculateClientScore(job: Job): number {
  const rating = numeric(job.clientRating);
  const spent = numeric(job.clientTotalSpent);
  if (rating === undefined && spent === undefined) return 5;

  const ratingScore = rating === undefined ? 5 : normalizeScore(rating * 2);
  let spentScore = 5;
  if (spent !== undefined) {
    if (spent >= 10000) spentScore = 10;
    else if (spent >= 1000) spentScore = 8;
    else if (spent > 0) spentScore = 6;
    else spentScore = 4;
  }
  return roundScore(ratingScore * 0.6 + spentScore * 0.4);
}

function calculateCompetitionScore(proposalCount: number | null, llmScore: number): number {
  if (proposalCount === null) return llmScore;
  let proposalScore: number;
  if (proposalCount <= 5) proposalScore = 9;
  else if (proposalCount <= 10) proposalScore = 8;
  else if (proposalCount <= 20) proposalScore = 6.5;
  else if (proposalCount <= 50) proposalScore = 4.5;
  else proposalScore = 2;
  return roundScore(llmScore * 0.6 + proposalScore * 0.4);
}

function numeric(value: { toString(): string } | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value.toString());
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeScore(value: number): number {
  return roundScore(Math.min(10, Math.max(0, value)));
}

function roundScore(value: number): number {
  return Math.round((value + 1e-9) * 10) / 10;
}
