import { createJobSchema } from './create-job.schema';

const validJob = {
  externalId: 'mock-123',
  title: 'Python automation',
  description: 'Build an integration.',
  url: 'https://example.com/jobs/mock-123',
};

describe('createJobSchema', () => {
  it('supplies defaults for a minimal simulated job', () => {
    const result = createJobSchema.parse(validJob);
    expect(result.budgetType).toBe('UNKNOWN');
    expect(result.skills).toEqual([]);
    expect(result.rawData).toEqual({});
  });

  it('rejects a budget range whose maximum is smaller than its minimum', () => {
    expect(createJobSchema.safeParse({ ...validJob, budgetMin: '500.00', budgetMax: '300.00' }).success).toBe(false);
  });

  it('rejects unknown fields and invalid client ratings', () => {
    expect(createJobSchema.safeParse({ ...validJob, status: 'IGNORED' }).success).toBe(false);
    expect(createJobSchema.safeParse({ ...validJob, clientRating: 5.5 }).success).toBe(false);
  });
});
