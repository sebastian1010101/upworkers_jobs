import { Module } from '@nestjs/common';
import { JobModule } from '../jobs/job.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MatchingModule } from '../matching/matching.module';
import { JobAnalysisController } from './job-analysis.controller';
import { JobAnalysisRepository } from './job-analysis.repository';
import { JobAnalyzerService } from './job-analyzer.service';
import { OpenAiAnalysisClient } from './openai-analysis.client';

@Module({
  imports: [JobModule, PrismaModule, MatchingModule],
  controllers: [JobAnalysisController],
  providers: [JobAnalysisRepository, JobAnalyzerService, OpenAiAnalysisClient],
  exports: [JobAnalyzerService],
})
export class AiModule {}
