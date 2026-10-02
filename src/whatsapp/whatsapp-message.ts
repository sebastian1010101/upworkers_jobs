import { Job, JobAnalysis } from '@prisma/client';

export interface WhatsAppTemplateMessage {
  templateName: string;
  languageCode: string;
  parameters: string[];
}

export function buildJobAlertParameters(job: Job, analysis: JobAnalysis): string[] {
  return [
    job.title,
    analysis.score.toString(),
    formatBudget(job),
    job.skills.length ? job.skills.slice(0, 8).join(', ') : 'Not specified',
    analysis.strengths.length ? analysis.strengths.slice(0, 3).join('; ') : 'No specific strengths identified',
    analysis.weaknesses[0] ?? 'No major weakness identified',
    job.url ?? 'URL unavailable in the API response',
  ].map((value) => compact(value, 500));
}

function formatBudget(job: Job): string {
  if (job.budgetType === 'FIXED') {
    return formatRange(job.budgetMin?.toString(), job.budgetMax?.toString(), 'USD');
  }
  if (job.budgetType === 'HOURLY') {
    return `${formatRange(job.hourlyMin?.toString(), job.hourlyMax?.toString(), 'USD')}/hour`;
  }
  return 'Not specified';
}

function formatRange(min?: string, max?: string, currency = ''): string {
  if (!min && !max) return 'Not specified';
  if (min && max && min !== max) return `${currency} ${min}–${max}`;
  return `${currency} ${min ?? max}`;
}

function compact(value: string, maximum: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length <= maximum ? normalized : `${normalized.slice(0, maximum - 1)}…`;
}
