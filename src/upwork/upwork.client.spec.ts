import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UpworkClient } from './upwork.client';

describe('UpworkClient', () => {
  const config = { get: (key: string) => ({
    UPWORK_ACCESS_TOKEN: 'test-token',
    EXTERNAL_RETRY_ATTEMPTS: 3,
    EXTERNAL_RETRY_BASE_DELAY_MS: 0,
    UPWORK_TIMEOUT_MS: 10000,
  }[key]) } as ConfigService;
  const client = new UpworkClient(config);
  const originalFetch = global.fetch;

  afterEach(() => { global.fetch = originalFetch; });

  it('uses the documented GraphQL search with a bearer token', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { marketplaceJobPostingsSearch: { edges: [{ node: {
        id: '123', title: 'Job', description: 'Description', ciphertext: 'abc', publishedDateTime: '2026-10-01T00:00:00Z',
      } }, { node: null }] } } }),
    });
    const results = await client.searchJobs('automation', 5);
    expect(results).toHaveLength(2);
    expect(results[1]).toBeNull();
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://api.upwork.com/graphql');
    expect(options.headers.Authorization).toBe('Bearer test-token');
    expect(JSON.parse(options.body).variables.filter).toEqual({ searchExpression_eq: 'automation', pagination_eq: { after: '0', first: 5 } });
  });

  it('rejects GraphQL errors even when HTTP succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ errors: [{ message: 'Missing scope' }] }),
    });
    await expect(client.searchJobs('automation', 5)).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('retries a transient provider failure', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ data: { marketplaceJobPostingsSearch: { edges: [] } } }),
      });

    await expect(client.searchJobs('automation', 5)).resolves.toEqual([]);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('does not retry permanent HTTP errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

    await expect(client.searchJobs('automation', 5)).rejects.toBeInstanceOf(BadGatewayException);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
