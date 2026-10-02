import { Module } from '@nestjs/common';
import { JobModule } from '../jobs/job.module';
import { UpworkRetentionScheduler } from './upwork-retention.scheduler';

@Module({
  imports: [JobModule],
  providers: [UpworkRetentionScheduler],
  exports: [UpworkRetentionScheduler],
})
export class SchedulerModule {}
