import { z } from 'zod';

const score = z.number().min(0).max(10);

export const jobAnalysisOutputSchema = z.object({
  score,
  technicalMatch: score,
  experienceMatch: score,
  portfolioMatch: score,
  englishRequirement: score,
  competition: score,
  strengths: z.array(z.string()).max(10),
  weaknesses: z.array(z.string()).max(10),
  recommendation: z.string(),
  shouldNotify: z.boolean(),
}).strict();

export type JobAnalysisOutput = z.infer<typeof jobAnalysisOutputSchema>;
