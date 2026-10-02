import { z } from 'zod';

export const proposalDraftOutputSchema = z.object({
  content: z.string().min(300).max(3000),
}).strict();

export type ProposalDraftOutput = z.infer<typeof proposalDraftOutputSchema>;
