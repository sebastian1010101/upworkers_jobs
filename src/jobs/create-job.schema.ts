import { z } from 'zod';

const money = z.string().regex(/^\d{1,10}(\.\d{1,2})?$/, 'Use a non-negative decimal string with at most two decimal places');

export const createJobSchema = z.object({
  externalId: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(500),
  description: z.string().trim().min(1),
  url: z.url(),
  budgetType: z.enum(['FIXED', 'HOURLY', 'UNKNOWN']).default('UNKNOWN'),
  budgetMin: money.optional(),
  budgetMax: money.optional(),
  hourlyMin: money.optional(),
  hourlyMax: money.optional(),
  skills: z.array(z.string().trim().min(1)).max(100).default([]),
  clientCountry: z.string().trim().min(1).max(100).optional(),
  clientRating: z.number().min(0).max(5).optional(),
  clientTotalSpent: money.optional(),
  proposalCount: z.number().int().nonnegative().optional(),
  publishedAt: z.iso.datetime({ offset: true }).optional(),
  rawData: z.record(z.string(), z.json()).default({}),
}).strict().superRefine((job, context) => {
  for (const [minKey, maxKey] of [['budgetMin', 'budgetMax'], ['hourlyMin', 'hourlyMax']] as const) {
    if (job[minKey] !== undefined && job[maxKey] !== undefined && Number(job[minKey]) > Number(job[maxKey])) {
      context.addIssue({ code: 'custom', path: [maxKey], message: `${maxKey} must be greater than or equal to ${minKey}` });
    }
  }
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
