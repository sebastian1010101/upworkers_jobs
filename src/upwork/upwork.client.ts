import { BadGatewayException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import { retry } from '../common/retry';

const GRAPHQL_URL = 'https://api.upwork.com/graphql';

// Query and field names come from Upwork's GraphQL marketplaceJobPostingsSearch documentation.
const SEARCH_JOBS_QUERY = `
  query SearchJobs($filter: MarketplaceJobPostingsSearchFilter) {
    marketplaceJobPostingsSearch(
      marketPlaceJobFilter: $filter
      searchType: USER_JOBS_SEARCH
      sortAttributes: [{ field: RECENCY }]
    ) {
      edges {
        node {
          id
          title
          description
          ciphertext
          publishedDateTime
          amount { displayValue currency }
          hourlyBudgetMin { displayValue currency }
          hourlyBudgetMax { displayValue currency }
          skills { name }
          client {
            totalFeedback
            totalSpent { displayValue currency }
            location { country }
          }
        }
      }
    }
  }
`;

const responseSchema = z.object({
  data: z.object({
    marketplaceJobPostingsSearch: z.object({
      edges: z.array(z.unknown()).nullable(),
    }).nullable(),
  }).nullable().optional(),
  errors: z.array(z.object({ message: z.string() })).optional(),
});

@Injectable()
export class UpworkClient {
  private readonly logger = new Logger(UpworkClient.name);

  constructor(private readonly config: ConfigService) {}

  async searchJobs(query: string, limit: number): Promise<unknown[]> {
    const token = this.config.get<string>('UPWORK_ACCESS_TOKEN');
    if (!token) throw new ServiceUnavailableException('UPWORK_ACCESS_TOKEN is not configured');

    let response: Response;
    try {
      response = await retry(async () => {
        let result: Response;
        try {
          result = await fetch(GRAPHQL_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
              ...(this.config.get<string>('UPWORK_TENANT_ID') ? { 'X-Upwork-API-TenantId': this.config.getOrThrow<string>('UPWORK_TENANT_ID') } : {}),
            },
            body: JSON.stringify({
              query: SEARCH_JOBS_QUERY,
              variables: { filter: { searchExpression_eq: query, pagination_eq: { after: '0', first: limit } } },
            }),
            signal: AbortSignal.timeout(this.config.get<number>('UPWORK_TIMEOUT_MS') ?? 10_000),
          });
        } catch {
          throw new TransientUpworkError('Upwork request timed out or failed');
        }
        if (result.status === 429 || result.status >= 500) {
          throw new TransientUpworkError(`Upwork returned HTTP ${result.status}`);
        }
        return result;
      }, {
        attempts: this.config.get<number>('EXTERNAL_RETRY_ATTEMPTS') ?? 3,
        baseDelayMs: this.config.get<number>('EXTERNAL_RETRY_BASE_DELAY_MS') ?? 250,
        shouldRetry: (error) => error instanceof TransientUpworkError,
        onRetry: ({ attempt, delayMs }) => this.logger.warn({
          event: 'external_retry', provider: 'upwork', attempt, delayMs,
        }),
      });
    } catch (error) {
      if (error instanceof TransientUpworkError) throw new BadGatewayException(error.message);
      throw error;
    }

    if (!response.ok) {
      throw new BadGatewayException(`Upwork returned HTTP ${response.status}`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new BadGatewayException('Invalid Upwork JSON response');
    }
    const parsed = responseSchema.safeParse(payload);
    if (!parsed.success) throw new BadGatewayException('Invalid Upwork GraphQL response');
    if (parsed.data.errors?.length) {
      throw new BadGatewayException(`Upwork GraphQL error: ${parsed.data.errors[0].message}`);
    }
    const edges = parsed.data.data?.marketplaceJobPostingsSearch?.edges;
    if (!edges) throw new BadGatewayException('Upwork returned no job search data');
    return edges.map((edge) => edge && typeof edge === 'object' && 'node' in edge ? edge.node : edge);
  }
}

class TransientUpworkError extends Error {}
