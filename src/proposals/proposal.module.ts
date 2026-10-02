import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { JobModule } from '../jobs/job.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OpenAiProposalClient } from './openai-proposal.client';
import { ProposalDraftRepository } from './proposal-draft.repository';
import { ProposalController } from './proposal.controller';
import { ProposalService } from './proposal.service';

@Module({
  imports: [AiModule, JobModule, PrismaModule],
  controllers: [ProposalController],
  providers: [OpenAiProposalClient, ProposalDraftRepository, ProposalService],
  exports: [ProposalService],
})
export class ProposalModule {}
