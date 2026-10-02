import { proposalDraftOutputSchema } from './proposal-draft.schema';

describe('proposalDraftOutputSchema', () => {
  it('accepts a complete proposal within the supported length', () => {
    const content = 'A'.repeat(300);
    expect(proposalDraftOutputSchema.parse({ content })).toEqual({ content });
  });

  it('rejects short, oversized, and additional output fields', () => {
    expect(() => proposalDraftOutputSchema.parse({ content: 'Too short' })).toThrow();
    expect(() => proposalDraftOutputSchema.parse({ content: 'A'.repeat(3001) })).toThrow();
    expect(() => proposalDraftOutputSchema.parse({ content: 'A'.repeat(300), subject: 'Extra' })).toThrow();
  });
});
