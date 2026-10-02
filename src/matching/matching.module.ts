import { Module } from '@nestjs/common';
import { JobFilterService } from './job-filter.service';
import { JobScoringService } from './job-scoring.service';

@Module({
  providers: [JobFilterService, JobScoringService],
  exports: [JobFilterService, JobScoringService],
})
export class MatchingModule {}
