import { ConfigService } from '@nestjs/config';
import { Job } from '@prisma/client';
import { JobFilterService } from './job-filter.service';
import { JobScoringService } from './job-scoring.service';

function job(overrides: Partial<Job> = {}): Job {
  return {
    title: 'AI automation developer',
    description: 'Build a Python API integration',
    skills: ['Python', 'OpenAI'],
    budgetType: 'FIXED',
    budgetMin: { toString: () => '300' },
    budgetMax: { toString: () => '500' },
    hourlyMin: null,
    hourlyMax: null,
    clientRating: { toString: () => '4.8' },
    clientTotalSpent: { toString: () => '20000' },
    proposalCount: 10,
    ...overrides,
  } as unknown as Job;
}

describe('JobScoringService', () => {
  const filters = {
    evaluate: jest.fn().mockReturnValue({
      decision: 'PASSED',
      reasons: [],
      matchedKeywords: ['ai', 'automation', 'python', 'api', 'integration', 'openai'],
    }),
  } as unknown as JobFilterService;
  const config = { getOrThrow: () => 8 } as unknown as ConfigService;
  const service = new JobScoringService(filters, config);

  it('combines LLM, rules, client quality, and competition with explicit weights', () => {
    expect(service.calculate(job(), { llmScore: 8.4, llmCompetitionScore: 7 })).toEqual({
      score: 8.5,
      llmScore: 8.4,
      ruleScore: 8.7,
      clientScore: 9.8,
      competitionScore: 7.4,
      llmCompetitionScore: 7,
      shouldNotify: true,
    });
  });

  it('uses neutral values when client, budget, and proposal data are unknown', () => {
    const noKeywords = { evaluate: jest.fn().mockReturnValue({ decision: 'PASSED', reasons: [], matchedKeywords: [] }) } as unknown as JobFilterService;
    const neutralService = new JobScoringService(noKeywords, config);
    const result = neutralService.calculate(job({
      budgetType: 'UNKNOWN',
      budgetMin: null,
      budgetMax: null,
      clientRating: null,
      clientTotalSpent: null,
      proposalCount: null,
    }), { llmScore: 6, llmCompetitionScore: 6 });

    expect(result).toMatchObject({
      score: 5.6,
      ruleScore: 4.3,
      clientScore: 5,
      competitionScore: 6,
      shouldNotify: false,
    });
  });

  it('penalizes crowded jobs and clamps provider scores to the 0–10 range', () => {
    const result = service.calculate(job({ proposalCount: 80 }), {
      llmScore: 12,
      llmCompetitionScore: -2,
    });

    expect(result.llmScore).toBe(10);
    expect(result.llmCompetitionScore).toBe(0);
    expect(result.competitionScore).toBe(0.8);
    expect(result.score).toBeLessThan(8.5);
  });
});
