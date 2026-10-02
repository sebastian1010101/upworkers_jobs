import { Module } from '@nestjs/common';
import { JobModule } from '../jobs/job.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { MatchingModule } from '../matching/matching.module';
import { AiModule } from '../ai/ai.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { UpworkClient } from './upwork.client';
import { UpworkController } from './upwork.controller';
import { UpworkService } from './upwork.service';
import { JobIngestionService } from './job-ingestion.service';

@Module({
  imports: [JobModule, SchedulerModule, MatchingModule, AiModule, NotificationsModule],
  controllers: [UpworkController],
  providers: [UpworkClient, JobIngestionService, UpworkService],
})
export class UpworkModule {}
