import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobAnalyzerService } from '../ai/job-analyzer.service';
import { JobService } from '../jobs/job.service';
import { WhatsAppClient } from '../whatsapp/whatsapp.client';
import { NotificationRepository } from './notification.repository';
import { NotificationService } from './notification.service';

const config = {
  getOrThrow: (key: string) => key === 'WHATSAPP_TEMPLATE_NAME' ? 'upwork_job_alert' : 'en_US',
} as unknown as ConfigService;

const job = {
  id: 'job-id',
  title: 'AI Automation',
  budgetType: 'UNKNOWN',
  skills: ['Python'],
  url: null,
};
const analysis = {
  score: { toString: () => '8.5' },
  strengths: ['Automation'],
  weaknesses: [],
  shouldNotify: true,
};

describe('NotificationService', () => {
  it('returns an already sent notification without sending a duplicate', async () => {
    const sent = { id: 'notification-id', status: 'SENT' };
    const repository = { findWhatsApp: jest.fn().mockResolvedValue(sent) } as unknown as NotificationRepository;
    const whatsapp = { isConfigured: () => true, sendTemplate: jest.fn() } as unknown as WhatsAppClient;
    const service = new NotificationService(
      { getById: jest.fn().mockResolvedValue(job) } as unknown as JobService,
      { get: jest.fn().mockResolvedValue(analysis) } as unknown as JobAnalyzerService,
      repository,
      whatsapp,
      config,
    );

    await expect(service.sendWhatsApp('job-id')).resolves.toBe(sent);
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('sends and marks a new notification with the external message id', async () => {
    const pending = { id: 'notification-id', status: 'PENDING' };
    const saved = { ...pending, status: 'SENT', externalMessageId: 'wamid.123' };
    const repository = {
      findWhatsApp: jest.fn().mockResolvedValue(null),
      createPending: jest.fn().mockResolvedValue(pending),
      markSent: jest.fn().mockResolvedValue(saved),
    } as unknown as NotificationRepository;
    const whatsapp = {
      isConfigured: () => true,
      sendTemplate: jest.fn().mockResolvedValue('wamid.123'),
    } as unknown as WhatsAppClient;
    const service = new NotificationService(
      { getById: jest.fn().mockResolvedValue(job) } as unknown as JobService,
      { get: jest.fn().mockResolvedValue(analysis) } as unknown as JobAnalyzerService,
      repository,
      whatsapp,
      config,
    );

    await expect(service.sendWhatsApp('job-id')).resolves.toBe(saved);
    expect(whatsapp.sendTemplate).toHaveBeenCalledWith(expect.objectContaining({
      templateName: 'upwork_job_alert',
      languageCode: 'en_US',
    }));
    expect(repository.markSent).toHaveBeenCalledWith('notification-id', 'wamid.123');
  });

  it('rejects jobs below the notification threshold before creating a record', async () => {
    const repository = { findWhatsApp: jest.fn() } as unknown as NotificationRepository;
    const service = new NotificationService(
      { getById: jest.fn().mockResolvedValue(job) } as unknown as JobService,
      { get: jest.fn().mockResolvedValue({ ...analysis, shouldNotify: false }) } as unknown as JobAnalyzerService,
      repository,
      { isConfigured: () => true } as unknown as WhatsAppClient,
      config,
    );

    await expect(service.sendWhatsApp('job-id')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.findWhatsApp).not.toHaveBeenCalled();
  });

  it('marks provider failures so a later request can retry', async () => {
    const pending = { id: 'notification-id', status: 'PENDING' };
    const repository = {
      findWhatsApp: jest.fn().mockResolvedValue(null),
      createPending: jest.fn().mockResolvedValue(pending),
      markFailed: jest.fn().mockResolvedValue({ ...pending, status: 'FAILED' }),
    } as unknown as NotificationRepository;
    const whatsapp = {
      isConfigured: () => true,
      sendTemplate: jest.fn().mockRejectedValue(new Error('network error')),
    } as unknown as WhatsAppClient;
    const service = new NotificationService(
      { getById: jest.fn().mockResolvedValue(job) } as unknown as JobService,
      { get: jest.fn().mockResolvedValue(analysis) } as unknown as JobAnalyzerService,
      repository,
      whatsapp,
      config,
    );

    await expect(service.sendWhatsApp('job-id')).rejects.toThrow('network error');
    expect(repository.markFailed).toHaveBeenCalledWith('notification-id', 'SEND_FAILED', 'network error');
  });
});
