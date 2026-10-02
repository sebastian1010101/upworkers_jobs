import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Job, Prisma } from '@prisma/client';
import { CreateJobInput } from './create-job.schema';
import { JobRepository } from './job.repository';
import type { MappedUpworkJob } from '../upwork/upwork-job.mapper';

export interface ImportedJobFilter {
  rejected: boolean;
  reasons: string[];
  evaluatedAt: Date;
}

@Injectable()
export class JobService {
  constructor(private readonly repository: JobRepository) {}

  async create(input: CreateJobInput): Promise<Job> {
    try {
      return await this.repository.create({
        ...input,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined,
        rawData: input.rawData as Prisma.InputJsonObject,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A job with this externalId already exists');
      }
      throw error;
    }
  }

  list(): Promise<Job[]> {
    return this.repository.list();
  }

  async getById(id: string): Promise<Job> {
    const job = await this.repository.findById(id);
    if (!job || (job.source === 'UPWORK' && job.expiresAt && job.expiresAt <= new Date())) {
      throw new NotFoundException('Job not found');
    }
    return job;
  }

  async importUpwork(input: MappedUpworkJob, filter: ImportedJobFilter): Promise<Job | null> {
    try {
      return await this.repository.create({
        ...input,
        source: 'UPWORK',
        status: filter.rejected ? 'IGNORED' : 'NEW',
        filterReasons: filter.reasons,
        filteredAt: filter.evaluatedAt,
        rawData: input.rawData as Prisma.InputJsonObject,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = error.meta?.target;
        if ((Array.isArray(target) && target.includes('externalId')) || (typeof target === 'string' && target.includes('externalId'))) {
          return null;
        }
      }
      throw error;
    }
  }

  async deleteExpiredUpwork(): Promise<number> {
    const result = await this.repository.deleteExpiredUpwork();
    return result.count;
  }

  updateStatus(id: string, status: 'NEW' | 'IGNORED' | 'SAVED'): Promise<Job> {
    return this.repository.updateStatus(id, status);
  }
}
