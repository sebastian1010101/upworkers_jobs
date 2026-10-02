import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { createJobSchema } from './create-job.schema';
import { JobService } from './job.service';

@Controller('jobs')
export class JobController {
  constructor(private readonly jobs: JobService) {}

  @Post()
  create(@Body() body: unknown) {
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })));
    }
    return this.jobs.create(parsed.data);
  }

  @Get()
  list() {
    return this.jobs.list();
  }

  @Get(':id')
  getById(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.jobs.getById(id);
  }
}
