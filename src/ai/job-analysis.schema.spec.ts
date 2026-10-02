import { jobAnalysisOutputSchema } from './job-analysis.schema';

const validAnalysis = {
  score: 8.4,
  technicalMatch: 9,
  experienceMatch: 7,
  portfolioMatch: 9,
  englishRequirement: 6,
  competition: 7,
  strengths: ['Relevant API experience'],
  weaknesses: ['B1 English'],
  recommendation: 'Apply with a focused proposal.',
  shouldNotify: true,
};

describe('jobAnalysisOutputSchema', () => {
  it('accepts the complete structured analysis', () => {
    expect(jobAnalysisOutputSchema.parse(validAnalysis)).toEqual(validAnalysis);
  });

  it('rejects out-of-range scores, missing fields, and unknown fields', () => {
    expect(jobAnalysisOutputSchema.safeParse({ ...validAnalysis, score: 10.1 }).success).toBe(false);
    expect(jobAnalysisOutputSchema.safeParse({ ...validAnalysis, recommendation: undefined }).success).toBe(false);
    expect(jobAnalysisOutputSchema.safeParse({ ...validAnalysis, explanation: 'extra' }).success).toBe(false);
  });
});
