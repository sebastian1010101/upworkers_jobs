import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, JobAnalysis, WhatsAppAction } from '@prisma/client';
import { JobAnalyzerService } from '../ai/job-analyzer.service';
import { JobService } from '../jobs/job.service';
import { ProposalService } from '../proposals/proposal.service';
import { WhatsAppClient } from './whatsapp.client';
import { extractTextMessages, WhatsAppInboundPayloadMessage, whatsAppWebhookSchema } from './whatsapp-webhook.schema';
import { WhatsAppWebhookRepository } from './whatsapp-webhook.repository';

export interface WebhookSummary {
  received: number;
  processed: number;
  duplicates: number;
  ignored: number;
  failed: number;
}

@Injectable()
export class WhatsAppWebhookService {
  private readonly logger = new Logger(WhatsAppWebhookService.name);

  constructor(
    private readonly repository: WhatsAppWebhookRepository,
    private readonly jobs: JobService,
    private readonly analyzer: JobAnalyzerService,
    private readonly proposals: ProposalService,
    private readonly whatsapp: WhatsAppClient,
    private readonly config: ConfigService,
  ) {}

  async handle(payload: unknown): Promise<WebhookSummary> {
    const parsed = whatsAppWebhookSchema.safeParse(payload);
    if (!parsed.success) throw new BadRequestException('Invalid WhatsApp webhook payload');
    const messages = extractTextMessages(parsed.data);
    const summary: WebhookSummary = { received: messages.length, processed: 0, duplicates: 0, ignored: 0, failed: 0 };

    for (const message of messages) {
      if (!this.isAllowedSender(message.from)) {
        summary.ignored += 1;
        continue;
      }
      const result = await this.processMessage(message);
      summary[result] += 1;
    }
    return summary;
  }

  private async processMessage(message: WhatsAppInboundPayloadMessage): Promise<'processed' | 'duplicates' | 'failed'> {
    const text = message.text!.body.trim();
    const action = parseAction(text);
    const reservation = await this.repository.reserve(message.id, message.from, text, action);
    if (reservation.duplicate) return 'duplicates';

    let jobId: string | null = null;
    try {
      const notification = message.context?.id
        ? await this.repository.findNotificationByMessageId(message.context.id)
        : await this.repository.findLatestNotification(new Date(Date.now() - 24 * 60 * 60 * 1000));
      jobId = notification?.jobId ?? null;

      if (!jobId) {
        await this.whatsapp.sendText(message.from, 'No encontré una alerta reciente asociada. Responde directamente al mensaje de la oferta.', message.id);
      } else {
        await this.execute(action, jobId, message);
      }
      await this.repository.markProcessed(reservation.message.id, jobId);
      return 'processed';
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unknown webhook processing error';
      await this.repository.markFailed(reservation.message.id, reason);
      this.logger.warn(`Unable to process WhatsApp message ${message.id}`);
      return 'failed';
    }
  }

  private async execute(action: WhatsAppAction, jobId: string, message: WhatsAppInboundPayloadMessage): Promise<void> {
    if (action === 'PROPOSAL_REQUESTED') {
      const draft = await this.proposals.generate(jobId);
      await this.whatsapp.sendText(message.from, formatProposalDraft(draft.content), message.id);
      return;
    }
    if (action === 'IGNORE') {
      await this.jobs.updateStatus(jobId, 'IGNORED');
      await this.whatsapp.sendText(message.from, 'Oferta ignorada.', message.id);
      return;
    }
    if (action === 'SAVE') {
      await this.jobs.updateStatus(jobId, 'SAVED');
      await this.whatsapp.sendText(message.from, 'Oferta guardada.', message.id);
      return;
    }
    if (action === 'SHOW_ANALYSIS') {
      const [job, analysis] = await Promise.all([this.jobs.getById(jobId), this.analyzer.get(jobId)]);
      await this.whatsapp.sendText(message.from, formatFullAnalysis(job, analysis), message.id);
      return;
    }
    await this.whatsapp.sendText(message.from, 'Respuesta no reconocida. Usa 1 para propuesta, 2 para ignorar, 3 para guardar o 4 para ver el análisis.', message.id);
  }

  private isAllowedSender(sender: string): boolean {
    const expected = this.config.get<string>('WHATSAPP_RECIPIENT_PHONE_NUMBER');
    return Boolean(expected && digits(sender) === digits(expected));
  }
}

function formatProposalDraft(content: string): string {
  return [
    '✍️ Borrador de propuesta',
    '',
    content,
    '',
    'Guardado para tu revisión. Aprobarlo no lo envía automáticamente a Upwork.',
  ].join('\n').slice(0, 4096);
}

function parseAction(text: string): WhatsAppAction {
  if (text === '1') return 'PROPOSAL_REQUESTED';
  if (text === '2') return 'IGNORE';
  if (text === '3') return 'SAVE';
  if (text === '4') return 'SHOW_ANALYSIS';
  return 'UNKNOWN';
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

function formatFullAnalysis(job: Job, analysis: JobAnalysis): string {
  return [
    `📊 ${job.title}`,
    `Score final: ${analysis.score}/10`,
    `Técnico: ${analysis.technicalScore}/10`,
    `Experiencia: ${analysis.experienceScore}/10`,
    `Portfolio: ${analysis.portfolioScore}/10`,
    `Inglés: ${analysis.communicationScore}/10`,
    `Competencia: ${analysis.competitionScore}/10`,
    `Fortalezas: ${analysis.strengths.join('; ') || 'Ninguna indicada'}`,
    `Debilidades: ${analysis.weaknesses.join('; ') || 'Ninguna indicada'}`,
    `Recomendación: ${analysis.recommendation}`,
  ].join('\n').slice(0, 4096);
}
