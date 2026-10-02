import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { JobAnalyzerService } from './job-analyzer.service';

@Controller('jobs')
export class JobAnalysisController {
  constructor(private readonly analyzer: JobAnalyzerService) {}

  @Post(':id/analysis')
  analyze(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.analyzer.analyze(id);
  }

  @Get(':id/analysis')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.analyzer.get(id);
  }

  @Post(':id/score')
  score(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.analyzer.rescore(id);
  }
}
