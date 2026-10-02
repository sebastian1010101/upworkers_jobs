import { Injectable } from '@nestjs/common';
import { UpworkRetentionScheduler } from '../scheduler/upwork-retention.scheduler';
import { JobIngestionService } from './job-ingestion.service';

@Injectable()
export class UpworkService {
  constructor(
    private readonly ingestion: JobIngestionService,
    private readonly retention: UpworkRetentionScheduler,
  ) {}

  async search(query: string, limit: number) {
    return this.ingestion.preview(query, limit);
  }

  async import(query: string, limit: number) {
    await this.retention.purgeExpired();
    return this.ingestion.ingest(query, limit);
  }
}
