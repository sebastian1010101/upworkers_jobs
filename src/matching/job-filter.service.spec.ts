import { ConfigService } from '@nestjs/config';
import { FilterableJob, JobFilterService } from './job-filter.service';

const config = {
  getOrThrow: (key: string) => key === 'JOB_FILTER_MIN_FIXED_BUDGET_USD' ? 100 : 10,
} as unknown as ConfigService;

const baseJob: FilterableJob = {
  title: 'AI automation developer',
  description: 'Build a Python API integration with OpenAI.',
  skills: ['Python', 'APIs'],
  budgetType: 'FIXED',
  budgetMin: '300.00',
  budgetMax: '500.00',
};

describe('JobFilterService', () => {
  const service = new JobFilterService(config);

  it('passes a relevant job that meets the budget threshold', () => {
    expect(service.evaluate(baseJob)).toEqual({
      decision: 'PASSED',
      reasons: [],
      matchedKeywords: expect.arrayContaining(['ai', 'automation', 'python', 'api', 'openai', 'integration']),
    });
  });

  it('rejects low fixed and hourly budgets using their highest advertised value', () => {
    expect(service.evaluate({ ...baseJob, budgetMin: '40', budgetMax: '99' }).reasons)
      .toContain('FIXED_BUDGET_TOO_LOW');
    expect(service.evaluate({
      ...baseJob,
      budgetType: 'HOURLY',
      budgetMin: undefined,
      budgetMax: undefined,
      hourlyMin: '5',
      hourlyMax: '9.99',
    }).reasons).toContain('HOURLY_RATE_TOO_LOW');
  });

  it('rejects explicit advanced English and excessive experience requirements', () => {
    const result = service.evaluate({
      ...baseJob,
      description: 'C1 English is mandatory. At least 7+ years of professional experience required.',
    });
    expect(result.decision).toBe('REJECTED');
    expect(result.reasons).toEqual(expect.arrayContaining([
      'ADVANCED_ENGLISH_REQUIRED',
      'EXCESSIVE_EXPERIENCE_REQUIRED',
    ]));
  });

  it('rejects a pure irrelevant specialty but keeps a mixed API integration', () => {
    const pureWordPress = service.evaluate({
      ...baseJob,
      title: 'WordPress Elementor specialist',
      description: 'Build landing pages with Divi.',
      skills: ['WordPress'],
    });
    expect(pureWordPress.reasons).toContain('IRRELEVANT_SPECIALTY');

    const mixed = service.evaluate({
      ...baseJob,
      title: 'WordPress API integration',
      description: 'Connect REST APIs using Node.js webhooks.',
      skills: ['WordPress', 'Node.js'],
    });
    expect(mixed.reasons).not.toContain('IRRELEVANT_SPECIALTY');
  });

  it('does not reject an unknown budget', () => {
    expect(service.evaluate({
      ...baseJob,
      budgetType: 'UNKNOWN',
      budgetMin: undefined,
      budgetMax: undefined,
    }).decision).toBe('PASSED');
  });
});
