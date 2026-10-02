import { JobService } from '../jobs/job.service';
import { UpworkClient } from './upwork.client';
import { JobIngestionService } from './job-ingestion.service';
import { JobFilterService } from '../matching/job-filter.service';
import { JobAnalyzerService } from '../ai/job-analyzer.service';
import { NotificationService } from '../notifications/notification.service';

function rawJob(id: string) {
  return {
    id,
    title: `Job ${id}`,
    description: 'Integrate APIs',
    ciphertext: `cipher-${id}`,
    publishedDateTime: '2026-10-01T00:00:00Z',
  };
}

describe('JobIngestionService', () => {
  const filters = {
    evaluate: jest.fn().mockReturnValue({ decision: 'PASSED', reasons: [], matchedKeywords: ['api'] }),
  } as unknown as JobFilterService;
  const analyzer = {
    isConfigured: jest.fn().mockReturnValue(false),
    analyze: jest.fn(),
  } as unknown as JobAnalyzerService;
  const notifications = {
    isConfigured: jest.fn().mockReturnValue(false),
    sendWhatsApp: jest.fn(),
  } as unknown as NotificationService;

  it('continues after malformed offers and individual persistence failures', async () => {
    const client = { searchJobs: jest.fn().mockResolvedValue([
      rawJob('1'), { id: 'bad', title: '' }, rawJob('2'), rawJob('3'),
    ]) } as unknown as UpworkClient;
    const importUpwork = jest.fn()
      .mockResolvedValueOnce({ id: 'saved' })
      .mockRejectedValueOnce(new Error('database error'))
      .mockResolvedValueOnce(null);
    const jobs = { importUpwork } as unknown as JobService;
    const ingestion = new JobIngestionService(client, jobs, filters, analyzer, notifications);

    await expect(ingestion.ingest('automation', 4)).resolves.toEqual({
      fetched: 4,
      normalized: 3,
      passed: 3,
      filtered: 0,
      created: 1,
      duplicates: 1,
      analyzed: 0,
      analysisFailed: 0,
      notificationsSent: 0,
      notificationFailed: 0,
      failed: 2,
      errors: [{ index: 1, stage: 'normalize' }, { index: 2, stage: 'persist' }],
    });
    expect(importUpwork).toHaveBeenCalledTimes(3);
  });

  it('previews valid jobs without persisting them', async () => {
    const client = { searchJobs: jest.fn().mockResolvedValue([rawJob('1'), null]) } as unknown as UpworkClient;
    const jobs = { importUpwork: jest.fn() } as unknown as JobService;
    const ingestion = new JobIngestionService(client, jobs, filters, analyzer, notifications);

    const result = await ingestion.preview('automation', 2);
    expect(result.fetched).toBe(2);
    expect(result.normalized).toBe(1);
    expect(result.passed).toBe(1);
    expect(result.filtered).toBe(0);
    expect(result.failed).toBe(1);
    expect(result.jobs[0].externalId).toBe('upwork:1');
    expect(jobs.importUpwork).not.toHaveBeenCalled();
  });

  it('does not persist anything when fetching fails', async () => {
    const client = { searchJobs: jest.fn().mockRejectedValue(new Error('Upwork unavailable')) } as unknown as UpworkClient;
    const jobs = { importUpwork: jest.fn() } as unknown as JobService;
    const ingestion = new JobIngestionService(client, jobs, filters, analyzer, notifications);

    await expect(ingestion.ingest('automation', 2)).rejects.toThrow('Upwork unavailable');
    expect(jobs.importUpwork).not.toHaveBeenCalled();
  });

  it('persists rejected jobs as ignored with deterministic reasons', async () => {
    const client = { searchJobs: jest.fn().mockResolvedValue([rawJob('filtered')]) } as unknown as UpworkClient;
    const jobs = { importUpwork: jest.fn().mockResolvedValue({ id: 'saved' }) } as unknown as JobService;
    const rejectedFilters = {
      evaluate: jest.fn().mockReturnValue({
        decision: 'REJECTED',
        reasons: ['ADVANCED_ENGLISH_REQUIRED'],
        matchedKeywords: ['api'],
      }),
    } as unknown as JobFilterService;
    const ingestion = new JobIngestionService(client, jobs, rejectedFilters, analyzer, notifications);

    const result = await ingestion.ingest('automation', 1);

    expect(result).toMatchObject({ normalized: 1, passed: 0, filtered: 1, created: 1 });
    expect(jobs.importUpwork).toHaveBeenCalledWith(
      expect.objectContaining({ externalId: 'upwork:filtered' }),
      expect.objectContaining({ rejected: true, reasons: ['ADVANCED_ENGLISH_REQUIRED'] }),
    );
  });

  it('isolates AI failures after persisting a passing job', async () => {
    const client = { searchJobs: jest.fn().mockResolvedValue([rawJob('ai-failure')]) } as unknown as UpworkClient;
    const jobs = { importUpwork: jest.fn().mockResolvedValue({ id: 'saved-job' }) } as unknown as JobService;
    const failingAnalyzer = {
      isConfigured: jest.fn().mockReturnValue(true),
      analyze: jest.fn().mockRejectedValue(new Error('provider unavailable')),
    } as unknown as JobAnalyzerService;
    const ingestion = new JobIngestionService(client, jobs, filters, failingAnalyzer, notifications);

    const result = await ingestion.ingest('automation', 1);

    expect(result).toMatchObject({ created: 1, analyzed: 0, analysisFailed: 1, failed: 1 });
    expect(result.errors).toContainEqual({ index: 0, stage: 'analyze' });
    expect(failingAnalyzer.analyze).toHaveBeenCalledWith('saved-job');
  });

  it('isolates notification failures after a successful analysis', async () => {
    const client = { searchJobs: jest.fn().mockResolvedValue([rawJob('notify-failure')]) } as unknown as UpworkClient;
    const jobs = { importUpwork: jest.fn().mockResolvedValue({ id: 'saved-job' }) } as unknown as JobService;
    const configuredAnalyzer = {
      isConfigured: jest.fn().mockReturnValue(true),
      analyze: jest.fn().mockResolvedValue({ shouldNotify: true }),
    } as unknown as JobAnalyzerService;
    const failingNotifications = {
      isConfigured: jest.fn().mockReturnValue(true),
      sendWhatsApp: jest.fn().mockRejectedValue(new Error('Meta unavailable')),
    } as unknown as NotificationService;
    const ingestion = new JobIngestionService(client, jobs, filters, configuredAnalyzer, failingNotifications);

    const result = await ingestion.ingest('automation', 1);

    expect(result).toMatchObject({
      created: 1,
      analyzed: 1,
      analysisFailed: 0,
      notificationsSent: 0,
      notificationFailed: 1,
      failed: 1,
    });
    expect(result.errors).toContainEqual({ index: 0, stage: 'notify' });
  });
});
