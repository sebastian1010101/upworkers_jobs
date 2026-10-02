import { mapUpworkJob } from './upwork-job.mapper';

describe('mapUpworkJob', () => {
  it('normalizes documented search fields and sets a short cache lifetime', () => {
    const discoveredAt = new Date('2026-10-01T12:00:00Z');
    const job = mapUpworkJob({
      id: '123',
      title: 'Automation developer',
      description: 'Connect APIs',
      ciphertext: 'encrypted-id',
      publishedDateTime: '2026-10-01T11:00:00Z',
      amount: { displayValue: '$1,200.50', currency: 'USD' },
      skills: [{ name: 'Python' }],
      client: { totalFeedback: 4.8, location: { country: 'United States' } },
    }, discoveredAt);

    expect(job.externalId).toBe('upwork:123');
    expect(job.budgetType).toBe('FIXED');
    expect(job.budgetMin).toBe('1200.50');
    expect(job.skills).toEqual(['Python']);
    expect(job.clientRating).toBe(4.8);
    expect(job.url).toBeNull();
    expect(job.expiresAt.toISOString()).toBe('2026-10-02T11:00:00.000Z');
  });

  it('does not treat an unsupported currency as USD', () => {
    const job = mapUpworkJob({
      id: '456',
      title: 'Backend job',
      description: 'Build a service',
      ciphertext: 'encrypted-id-2',
      publishedDateTime: '2026-10-01T11:00:00Z',
      amount: { displayValue: '€500', currency: 'EUR' },
    });
    expect(job.budgetType).toBe('UNKNOWN');
    expect(job.budgetMin).toBeUndefined();
  });
});
