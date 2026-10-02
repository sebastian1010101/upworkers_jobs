import { Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ProposalService } from './proposal.service';

@Controller('jobs')
export class ProposalController {
  constructor(private readonly proposals: ProposalService) {}

  @Post(':id/proposal')
  generate(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.proposals.generate(id);
  }

  @Get(':id/proposal')
  get(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.proposals.get(id);
  }

  @Post(':id/proposal/approve')
  approve(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.proposals.approve(id);
  }
}
