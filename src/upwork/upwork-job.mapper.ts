import { z } from 'zod';

const moneySchema = z.object({
  displayValue: z.string(),
  currency: z.string(),
}).nullable().optional();

export const upworkSearchResultSchema = z.object({
  id: z.string().min(1).max(248),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1),
  ciphertext: z.string().min(1),
  publishedDateTime: z.string(),
  amount: moneySchema,
  hourlyBudgetMin: moneySchema,
  hourlyBudgetMax: moneySchema,
  skills: z.array(z.object({ name: z.string().trim().min(1) }).nullable()).max(100).nullable().optional(),
  client: z.object({
    totalFeedback: z.number().nullable().optional(),
    totalSpent: moneySchema,
    location: z.object({ country: z.string().nullable().optional() }).nullable().optional(),
  }).nullable().optional(),
});

export type UpworkSearchResult = z.infer<typeof upworkSearchResultSchema>;

export interface MappedUpworkJob {
  externalId: string;
  title: string;
  description: string;
  url: null;
  budgetType: 'FIXED' | 'HOURLY' | 'UNKNOWN';
  budgetMin?: string;
  budgetMax?: string;
  hourlyMin?: string;
  hourlyMax?: string;
  skills: string[];
  clientCountry?: string;
  clientRating?: number;
  clientTotalSpent?: string;
  publishedAt?: Date;
  expiresAt: Date;
  rawData: Record<string, unknown>;
}

function decimalValue(value: z.infer<typeof moneySchema>, maximumIntegerDigits: number): string | undefined {
  if (!value || value.currency !== 'USD') return undefined;
  const match = /^(?:USD\s*|\$)?([\d,]+)(?:\.(\d{1,2}))?$/.exec(value.displayValue.trim());
  if (!match) return undefined;
  const integer = match[1].replaceAll(',', '');
  if (integer.length > maximumIntegerDigits) return undefined;
  return `${integer}.${(match[2] ?? '').padEnd(2, '0')}`;
}

export function mapUpworkJob(node: UpworkSearchResult, discoveredAt = new Date()): MappedUpworkJob {
  const fixedAmount = decimalValue(node.amount, 10);
  const hourlyMin = decimalValue(node.hourlyBudgetMin, 10);
  const hourlyMax = decimalValue(node.hourlyBudgetMax, 10);
  const totalSpent = decimalValue(node.client?.totalSpent, 12);
  const publishedAt = new Date(node.publishedDateTime);
  const clientRating = node.client?.totalFeedback;

  return {
    externalId: `upwork:${node.id}`,
    title: node.title,
    description: node.description,
    url: null,
    budgetType: hourlyMin || hourlyMax ? 'HOURLY' : fixedAmount ? 'FIXED' : 'UNKNOWN',
    ...(fixedAmount ? { budgetMin: fixedAmount, budgetMax: fixedAmount } : {}),
    ...(hourlyMin ? { hourlyMin } : {}),
    ...(hourlyMax ? { hourlyMax } : {}),
    skills: (node.skills ?? []).flatMap((skill) => skill ? [skill.name] : []),
    ...(node.client?.location?.country ? { clientCountry: node.client.location.country } : {}),
    ...(typeof clientRating === 'number' && clientRating >= 0 && clientRating <= 5 ? { clientRating } : {}),
    ...(totalSpent ? { clientTotalSpent: totalSpent } : {}),
    ...(!Number.isNaN(publishedAt.getTime()) ? { publishedAt } : {}),
    expiresAt: new Date(discoveredAt.getTime() + 23 * 60 * 60 * 1000),
    rawData: {
      provider: 'upwork',
      ciphertext: node.ciphertext,
      currency: node.amount?.currency ?? node.hourlyBudgetMin?.currency ?? node.hourlyBudgetMax?.currency ?? null,
      fixedBudgetDisplay: node.amount?.displayValue ?? null,
      hourlyMinDisplay: node.hourlyBudgetMin?.displayValue ?? null,
      hourlyMaxDisplay: node.hourlyBudgetMax?.displayValue ?? null,
    },
  };
}
