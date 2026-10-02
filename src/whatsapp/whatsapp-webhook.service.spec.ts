import { ConfigService } from '@nestjs/config';
import { JobAnalyzerService } from '../ai/job-analyzer.service';
import { JobService } from '../jobs/job.service';
import { ProposalService } from '../proposals/proposal.service';
import { WhatsAppClient } from './whatsapp.client';
import { WhatsAppWebhookRepository } from './whatsapp-webhook.repository';
import { WhatsAppWebhookService } from './whatsapp-webhook.service';

function payload(body: string, from = '5511999999999') {
  return {
    object: 'whatsapp_business_account',
    entry: [{ changes: [{
      field: 'messages',
      value: {
        messages: [{
          from,
          id: `wamid.inbound-${body}`,
          type: 'text',
          text: { body },
          context: { id: 'wamid.outbound' },
        }],
      },
    }] }],
  };
}

function dependencies() {
  const repository = {
    reserve: jest.fn().mockResolvedValue({ message: { id: 'inbound-id' }, duplicate: false }),
    findNotificationByMessageId: jest.fn().mockResolvedValue({ jobId: 'job-id' }),
    markProcessed: jest.fn().mockResolvedValue({}),
    markFailed: jest.fn().mockResolvedValue({}),
  } as unknown as WhatsAppWebhookRepository;
  const jobs = {
    updateStatus: jest.fn().mockResolvedValue({}),
    getById: jest.fn().mockResolvedValue({ title: 'AI job' }),
  } as unknown as JobService;
  const analyzer = {
    get: jest.fn().mockResolvedValue({
      score: 8.5,
      technicalScore: 9,
      experienceScore: 8,
      portfolioScore: 9,
      communicationScore: 6,
      competitionScore: 7,
      strengths: ['Automation'],
      weaknesses: ['English'],
      recommendation: 'Apply',
    }),
  } as unknown as JobAnalyzerService;
  const proposals = {
    generate: jest.fn().mockResolvedValue({ content: 'A proposal tailored to this automation project.' }),
  } as unknown as ProposalService;
  const whatsapp = { sendText: jest.fn().mockResolvedValue('wamid.reply') } as unknown as WhatsAppClient;
  const config = { get: () => '+5511999999999' } as unknown as ConfigService;
  return { repository, jobs, analyzer, proposals, whatsapp, config };
}

describe('WhatsAppWebhookService', () => {
  it.each([
    ['2', 'IGNORE', 'IGNORED'],
    ['3', 'SAVE', 'SAVED'],
  ])('executes action %s exactly once', async (body, action, status) => {
    const deps = dependencies();
    const service = new WhatsAppWebhookService(deps.repository, deps.jobs, deps.analyzer, deps.proposals, deps.whatsapp, deps.config);

    await expect(service.handle(payload(body))).resolves.toEqual({
      received: 1, processed: 1, duplicates: 0, ignored: 0, failed: 0,
    });
    expect(deps.repository.reserve).toHaveBeenCalledWith(`wamid.inbound-${body}`, '5511999999999', body, action);
    expect(deps.jobs.updateStatus).toHaveBeenCalledWith('job-id', status);
    expect(deps.repository.markProcessed).toHaveBeenCalledWith('inbound-id', 'job-id');
  });

  it('generates and returns the proposal draft for action 1', async () => {
    const deps = dependencies();
    const service = new WhatsAppWebhookService(deps.repository, deps.jobs, deps.analyzer, deps.proposals, deps.whatsapp, deps.config);

    await service.handle(payload('1'));

    expect(deps.repository.reserve).toHaveBeenCalledWith(
      'wamid.inbound-1', '5511999999999', '1', 'PROPOSAL_REQUESTED',
    );
    expect(deps.jobs.updateStatus).not.toHaveBeenCalled();
    expect(deps.proposals.generate).toHaveBeenCalledWith('job-id');
    expect(deps.whatsapp.sendText).toHaveBeenCalledWith(
      '5511999999999', expect.stringContaining('A proposal tailored'), 'wamid.inbound-1',
    );
  });

  it('returns the full analysis for action 4', async () => {
    const deps = dependencies();
    const service = new WhatsAppWebhookService(deps.repository, deps.jobs, deps.analyzer, deps.proposals, deps.whatsapp, deps.config);

    await service.handle(payload('4'));

    expect(deps.analyzer.get).toHaveBeenCalledWith('job-id');
    expect(deps.whatsapp.sendText).toHaveBeenCalledWith(
      '5511999999999', expect.stringContaining('Score final: 8.5/10'), 'wamid.inbound-4',
    );
  });

  it('does not repeat a previously reserved inbound message', async () => {
    const deps = dependencies();
    (deps.repository.reserve as jest.Mock).mockResolvedValue({ message: { id: 'inbound-id' }, duplicate: true });
    const service = new WhatsAppWebhookService(deps.repository, deps.jobs, deps.analyzer, deps.proposals, deps.whatsapp, deps.config);

    await expect(service.handle(payload('2'))).resolves.toMatchObject({ duplicates: 1, processed: 0 });
    expect(deps.jobs.updateStatus).not.toHaveBeenCalled();
    expect(deps.whatsapp.sendText).not.toHaveBeenCalled();
  });

  it('ignores messages from phone numbers other than the configured owner', async () => {
    const deps = dependencies();
    const service = new WhatsAppWebhookService(deps.repository, deps.jobs, deps.analyzer, deps.proposals, deps.whatsapp, deps.config);

    await expect(service.handle(payload('2', '5511888888888'))).resolves.toMatchObject({ ignored: 1, processed: 0 });
    expect(deps.repository.reserve).not.toHaveBeenCalled();
  });
});
