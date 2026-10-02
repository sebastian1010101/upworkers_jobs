import { Injectable, Logger } from '@nestjs/common';
import { JobService } from '../jobs/job.service';
import { UpworkClient } from './upwork.client';
import { mapUpworkJob, MappedUpworkJob, upworkSearchResultSchema } from './upwork-job.mapper';
import { JobFilterResult, JobFilterService } from '../matching/job-filter.service';
import { JobAnalyzerService } from '../ai/job-analyzer.service';
import { NotificationService } from '../notifications/notification.service';

export interface IngestionError {
  index: number;
  stage: 'normalize' | 'persist' | 'analyze' | 'notify';
}

export interface IngestionSummary {
  fetched: number;
  normalized: number;
  passed: number;
  filtered: number;
  created: number;
  duplicates: number;
  analyzed: number;
  analysisFailed: number;
  notificationsSent: number;
  notificationFailed: number;
  failed: number;
  errors: IngestionError[];
}

@Injectable()
export class JobIngestionService {
  private readonly logger = new Logger(JobIngestionService.name);

  constructor(
    private readonly client: UpworkClient,
    private readonly jobs: JobService,
    private readonly filters: JobFilterService,
    private readonly analyzer: JobAnalyzerService,
    private readonly notifications: NotificationService,
  ) {}

  async preview(query: string, limit: number): Promise<Pick<IngestionSummary, 'fetched' | 'normalized' | 'passed' | 'filtered' | 'failed' | 'errors'> & { jobs: Array<MappedUpworkJob & { filter: JobFilterResult }> }> {
    const rawJobs = await this.client.searchJobs(query, limit);
    const { jobs, errors } = this.normalize(rawJobs);
    return {
      fetched: rawJobs.length,
      normalized: jobs.length,
      passed: jobs.filter(({ filter }) => filter.decision === 'PASSED').length,
      filtered: jobs.filter(({ filter }) => filter.decision === 'REJECTED').length,
      failed: errors.length,
      errors,
      jobs: jobs.map(({ job, filter }) => ({ ...job, filter })),
    };
  }

  async ingest(query: string, limit: number): Promise<IngestionSummary> {
    const rawJobs = await this.client.searchJobs(query, limit);
    const { jobs, errors } = this.normalize(rawJobs);
    let created = 0;
    let duplicates = 0;
    let analyzed = 0;
    let analysisFailed = 0;
    let notificationsSent = 0;
    let notificationFailed = 0;

    for (const { index, job, filter } of jobs) {
      try {
        const result = await this.jobs.importUpwork(job, {
          rejected: filter.decision === 'REJECTED',
          reasons: filter.reasons,
          evaluatedAt: new Date(),
        });
        if (result) {
          created += 1;
          if (filter.decision === 'PASSED' && this.analyzer.isConfigured()) {
            try {
              const analysis = await this.analyzer.analyze(result.id);
              analyzed += 1;
              if (analysis.shouldNotify && this.notifications.isConfigured()) {
                try {
                  await this.notifications.sendWhatsApp(result.id);
                  notificationsSent += 1;
                } catch {
                  notificationFailed += 1;
                  errors.push({ index, stage: 'notify' });
                  this.logger.warn(`Unable to notify imported Upwork search result at index ${index}`);
                }
              }
            } catch {
              analysisFailed += 1;
              errors.push({ index, stage: 'analyze' });
              this.logger.warn(`Unable to analyze imported Upwork search result at index ${index}`);
            }
          }
        } else duplicates += 1;
      } catch {
        errors.push({ index, stage: 'persist' });
        this.logger.warn(`Unable to persist Upwork search result at index ${index}`);
      }
    }

    return {
      fetched: rawJobs.length,
      normalized: jobs.length,
      passed: jobs.filter(({ filter }) => filter.decision === 'PASSED').length,
      filtered: jobs.filter(({ filter }) => filter.decision === 'REJECTED').length,
      created,
      duplicates,
      analyzed,
      analysisFailed,
      notificationsSent,
      notificationFailed,
      failed: errors.length,
      errors,
    };
  }

  private normalize(rawJobs: unknown[]) {
    const jobs: Array<{ index: number; job: MappedUpworkJob; filter: JobFilterResult }> = [];
    const errors: IngestionError[] = [];
    const discoveredAt = new Date();

    rawJobs.forEach((raw, index) => {
      const parsed = upworkSearchResultSchema.safeParse(raw);
      if (!parsed.success) {
        errors.push({ index, stage: 'normalize' });
        this.logger.warn(`Invalid Upwork search result at index ${index}`);
        return;
      }
      try {
        const job = mapUpworkJob(parsed.data, discoveredAt);
        jobs.push({ index, job, filter: this.filters.evaluate(job) });
      } catch {
        errors.push({ index, stage: 'normalize' });
        this.logger.warn(`Unable to normalize Upwork search result at index ${index}`);
      }
    });

    return { jobs, errors };
  }
}
