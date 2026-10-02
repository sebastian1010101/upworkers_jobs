import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { JobController } from './job.controller';
import { JobRepository } from './job.repository';
import { JobService } from './job.service';

@Module({
  imports: [PrismaModule],
  controllers: [JobController],
  providers: [JobRepository, JobService],
  exports: [JobService],
})
export class JobModule {}
