import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobService } from '../jobs/job.service';

@Injectable()
export class UpworkRetentionScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UpworkRetentionScheduler.name);
  private timer?: NodeJS.Timeout;
  private currentPurge?: Promise<number>;

  constructor(
    private readonly jobs: JobService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.purgeExpired();
    const minutes = this.config.getOrThrow<number>('UPWORK_CACHE_SWEEP_MINUTES');
    this.timer = setInterval(() => {
      void this.purgeExpired().catch((error) => this.logger.error('Failed to delete expired Upwork jobs', error));
    }, minutes * 60 * 1000);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  purgeExpired(): Promise<number> {
    if (!this.currentPurge) {
      this.currentPurge = this.jobs.deleteExpiredUpwork()
        .then((count) => {
          if (count) this.logger.log(`Deleted ${count} expired Upwork jobs`);
          return count;
        })
        .finally(() => { this.currentPurge = undefined; });
    }
    return this.currentPurge;
  }
}
