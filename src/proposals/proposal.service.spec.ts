import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JobAnalyzerService } from '../ai/job-analyzer.service';
import { JobService } from '../jobs/job.service';
import { OpenAiProposalClient } from './openai-proposal.client';
import { ProposalDraftRepository } from './proposal-draft.repository';
import { ProposalService } from './proposal.service';

function dependencies() {
  const jobs = { getById: jest.fn().mockResolvedValue({ id: 'job-id', status: 'NEW' }) } as unknown as JobService;
  const analyzer = { analyze: jest.fn().mockResolvedValue({ id: 'analysis-id' }) } as unknown as JobAnalyzerService;
  const drafts = {
    findByJobId: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'draft-id', jobId: 'job-id', content: 'Personalized draft' }),
    approve: jest.fn().mockResolvedValue({ id: 'draft-id', approved: true }),
  } as unknown as ProposalDraftRepository;
  const ai = {
    generate: jest.fn().mockResolvedValue({ content: '  Personalized draft  ' }),
    getModel: jest.fn().mockReturnValue('test-model'),
  } as unknown as OpenAiProposalClient;
  return { jobs, analyzer, drafts, ai };
}

describe('ProposalService', () => {
  it('returns an existing draft without another analysis or model call', async () => {
    const deps = dependencies();
    const existing = { id: 'draft-id', jobId: 'job-id' };
    (deps.drafts.findByJobId as jest.Mock).mockResolvedValue(existing);
    const service = new ProposalService(deps.jobs, deps.analyzer, deps.drafts, deps.ai);

    await expect(service.generate('job-id')).resolves.toBe(existing);
    expect(deps.jobs.getById).not.toHaveBeenCalled();
    expect(deps.analyzer.analyze).not.toHaveBeenCalled();
    expect(deps.ai.generate).not.toHaveBeenCalled();
  });

  it('uses the accepted job and its analysis and persists a draft', async () => {
    const deps = dependencies();
    const job = { id: 'job-id', status: 'NEW' };
    const analysis = { id: 'analysis-id' };
    (deps.jobs.getById as jest.Mock).mockResolvedValue(job);
    (deps.analyzer.analyze as jest.Mock).mockResolvedValue(analysis);
    const service = new ProposalService(deps.jobs, deps.analyzer, deps.drafts, deps.ai);

    await expect(service.generate('job-id')).resolves.toMatchObject({ id: 'draft-id' });
    expect(deps.ai.generate).toHaveBeenCalledWith(job, analysis);
    expect(deps.drafts.create).toHaveBeenCalledWith({
      job: { connect: { id: 'job-id' } },
      content: 'Personalized draft',
      model: 'test-model',
    });
  });

  it('does not generate a proposal for an ignored job', async () => {
    const deps = dependencies();
    (deps.jobs.getById as jest.Mock).mockResolvedValue({ id: 'job-id', status: 'IGNORED' });
    const service = new ProposalService(deps.jobs, deps.analyzer, deps.drafts, deps.ai);

    await expect(service.generate('job-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(deps.analyzer.analyze).not.toHaveBeenCalled();
    expect(deps.ai.generate).not.toHaveBeenCalled();
  });

  it('requires an existing draft before human approval', async () => {
    const deps = dependencies();
    const service = new ProposalService(deps.jobs, deps.analyzer, deps.drafts, deps.ai);

    await expect(service.approve('job-id')).rejects.toBeInstanceOf(NotFoundException);
    expect(deps.drafts.approve).not.toHaveBeenCalled();
  });

  it('marks a draft as approved exactly once', async () => {
    const deps = dependencies();
    (deps.drafts.findByJobId as jest.Mock).mockResolvedValue({ id: 'draft-id', approved: false });
    const service = new ProposalService(deps.jobs, deps.analyzer, deps.drafts, deps.ai);

    await expect(service.approve('job-id')).resolves.toMatchObject({ approved: true });
    expect(deps.drafts.approve).toHaveBeenCalledWith('job-id');
  });
});
