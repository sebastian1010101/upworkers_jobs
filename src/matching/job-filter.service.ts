import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type JobFilterReason =
  | 'FIXED_BUDGET_TOO_LOW'
  | 'HOURLY_RATE_TOO_LOW'
  | 'ADVANCED_ENGLISH_REQUIRED'
  | 'EXCESSIVE_EXPERIENCE_REQUIRED'
  | 'IRRELEVANT_SPECIALTY';

export interface FilterableJob {
  title: string;
  description: string;
  skills: string[];
  budgetType: 'FIXED' | 'HOURLY' | 'UNKNOWN';
  budgetMin?: string;
  budgetMax?: string;
  hourlyMin?: string;
  hourlyMax?: string;
}

export interface JobFilterResult {
  decision: 'PASSED' | 'REJECTED';
  reasons: JobFilterReason[];
  matchedKeywords: string[];
}

const RELEVANT_KEYWORDS = [
  'ai', 'automation', 'typescript', 'javascript', 'react', 'next.js', 'node.js',
  'nestjs', 'python', 'fastapi', 'postgresql', 'supabase', 'api', 'webhook',
  'docker', 'openai', 'llm', 'rag', 'agent', 'playwright', 'scraping',
  'monitoring', 'integration', 'backend', 'full-stack', 'full stack',
] as const;

const IRRELEVANT_SPECIALTIES = [
  'wordpress', 'elementor', 'divi', 'graphic design', 'logo design', 'logo designer',
  'webflow', 'data entry',
] as const;

@Injectable()
export class JobFilterService {
  constructor(private readonly config: ConfigService) {}

  evaluate(job: FilterableJob): JobFilterResult {
    const reasons = new Set<JobFilterReason>();
    const text = normalize([job.title, job.description, ...job.skills].join(' '));
    const matchedKeywords = RELEVANT_KEYWORDS.filter((keyword) => contains(text, keyword));

    if (job.budgetType === 'FIXED') {
      const ceiling = toNumber(job.budgetMax ?? job.budgetMin);
      const minimum = this.config.getOrThrow<number>('JOB_FILTER_MIN_FIXED_BUDGET_USD');
      if (ceiling !== undefined && ceiling < minimum) reasons.add('FIXED_BUDGET_TOO_LOW');
    }

    if (job.budgetType === 'HOURLY') {
      const ceiling = toNumber(job.hourlyMax ?? job.hourlyMin);
      const minimum = this.config.getOrThrow<number>('JOB_FILTER_MIN_HOURLY_RATE_USD');
      if (ceiling !== undefined && ceiling < minimum) reasons.add('HOURLY_RATE_TOO_LOW');
    }

    if (requiresAdvancedEnglish(text)) reasons.add('ADVANCED_ENGLISH_REQUIRED');
    if (requiredExperienceYears(text) >= 7) reasons.add('EXCESSIVE_EXPERIENCE_REQUIRED');

    const hasIrrelevantSpecialty = IRRELEVANT_SPECIALTIES.some((keyword) => contains(text, keyword));
    if (hasIrrelevantSpecialty && matchedKeywords.length === 0) reasons.add('IRRELEVANT_SPECIALTY');

    return {
      decision: reasons.size === 0 ? 'PASSED' : 'REJECTED',
      reasons: [...reasons],
      matchedKeywords: [...new Set(matchedKeywords)],
    };
  }
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function contains(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text);
}

function toNumber(value?: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function requiresAdvancedEnglish(text: string): boolean {
  return /\b(?:native|fluent)\s+(?:level\s+)?english\b|\benglish\s+(?:at\s+)?(?:native|fluent|c1|c2)\b|\b(?:c1|c2)\s+english\b/.test(text);
}

function requiredExperienceYears(text: string): number {
  const years = [...text.matchAll(/\b(\d{1,2})\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:professional\s+)?experience\b/g)]
    .map((match) => Number(match[1]));
  return years.length ? Math.max(...years) : 0;
}
