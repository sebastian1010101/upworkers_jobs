import { BadRequestException } from '@nestjs/common';
import { JobService } from '../jobs/job.service';
import { JobAnalysisRepository } from './job-analysis.repository';
import { JobAnalyzerService } from './job-analyzer.service';
import { OpenAiAnalysisClient } from './openai-analysis.client';
import { JobScoringService } from '../matching/job-scoring.service';

const output = {
  score: 8.4,
  technicalMatch: 9,
  experienceMatch: 7,
  portfolioMatch: 9,
  englishRequirement: 6,
  competition: 7,
  strengths: ['Python automation'],
  weaknesses: ['English requirement'],
  recommendation: 'Apply.',
  shouldNotify: true,
};

describe('JobAnalyzerService', () => {
  const scoringResult = {
    score: 8.2,
    llmScore: 8.4,
    ruleScore: 8,
    clientScore: 7,
    competitionScore: 7.4,
    llmCompetitionScore: 7,
    shouldNotify: true,
  };
  const scoring = { calculate: jest.fn().mockReturnValue(scoringResult) } as unknown as JobScoringService;

  it('returns an existing analysis without another model call', async () => {
    const existing = { id: 'analysis-id', jobId: 'job-id' };
    const analyses = { findByJobId: jest.fn().mockResolvedValue(existing) } as unknown as JobAnalysisRepository;
    const jobs = { getById: jest.fn() } as unknown as JobService;
    const ai = { analyze: jest.fn() } as unknown as OpenAiAnalysisClient;
    const service = new JobAnalyzerService(jobs, analyses, ai, scoring);

    await expect(service.analyze('job-id')).resolves.toBe(existing);
    expect(jobs.getById).not.toHaveBeenCalled();
    expect(ai.analyze).not.toHaveBeenCalled();
  });

  it('does not send ignored jobs to the model', async () => {
    const analyses = { findByJobId: jest.fn().mockResolvedValue(null) } as unknown as JobAnalysisRepository;
    const jobs = { getById: jest.fn().mockResolvedValue({ id: 'job-id', status: 'IGNORED' }) } as unknown as JobService;
    const ai = { analyze: jest.fn() } as unknown as OpenAiAnalysisClient;
    const service = new JobAnalyzerService(jobs, analyses, ai, scoring);

    await expect(service.analyze('job-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(ai.analyze).not.toHaveBeenCalled();
  });

  it('persists the validated model output with its model identifier', async () => {
    const job = { id: 'job-id', status: 'NEW' };
    const saved = { id: 'analysis-id', jobId: 'job-id' };
    const analyses = {
      findByJobId: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(saved),
    } as unknown as JobAnalysisRepository;
    const jobs = { getById: jest.fn().mockResolvedValue(job) } as unknown as JobService;
    const ai = {
      analyze: jest.fn().mockResolvedValue(output),
      getModel: jest.fn().mockReturnValue('test-model'),
    } as unknown as OpenAiAnalysisClient;
    const service = new JobAnalyzerService(jobs, analyses, ai, scoring);

    await expect(service.analyze('job-id')).resolves.toBe(saved);
    expect(analyses.create).toHaveBeenCalledWith(expect.objectContaining({
      score: 8.2,
      llmScore: 8.4,
      ruleScore: 8,
      clientScore: 7,
      technicalScore: 9,
      communicationScore: 6,
      competitionScore: 7.4,
      llmCompetitionScore: 7,
      shouldNotify: true,
      model: 'test-model',
      job: { connect: { id: 'job-id' } },
    }));
  });

  it('recalculates a stored score without calling the model', async () => {
    const job = { id: 'job-id', status: 'NEW' };
    const analysis = { llmScore: '8.4', llmCompetitionScore: '7.0' };
    const updated = { id: 'analysis-id', score: '8.2' };
    const analyses = {
      findByJobId: jest.fn().mockResolvedValue(analysis),
      updateScoring: jest.fn().mockResolvedValue(updated),
    } as unknown as JobAnalysisRepository;
    const jobs = { getById: jest.fn().mockResolvedValue(job) } as unknown as JobService;
    const ai = { analyze: jest.fn() } as unknown as OpenAiAnalysisClient;
    const service = new JobAnalyzerService(jobs, analyses, ai, scoring);

    await expect(service.rescore('job-id')).resolves.toBe(updated);
    expect(ai.analyze).not.toHaveBeenCalled();
    expect(scoring.calculate).toHaveBeenCalledWith(job, {
      llmScore: 8.4,
      llmCompetitionScore: 7,
    });
    expect(analyses.updateScoring).toHaveBeenCalledWith('job-id', expect.objectContaining({
      score: 8.2,
      shouldNotify: true,
    }));
  });
});
