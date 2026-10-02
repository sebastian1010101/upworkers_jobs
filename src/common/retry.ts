export interface RetryOptions {
  attempts: number;
  baseDelayMs: number;
  shouldRetry: (error: unknown) => boolean;
  onRetry?: (details: { attempt: number; delayMs: number; error: unknown }) => void;
}

export async function retry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= options.attempts || !options.shouldRetry(error)) throw error;
      const delayMs = Math.min(options.baseDelayMs * 2 ** (attempt - 1), 5000);
      options.onRetry?.({ attempt, delayMs, error });
      if (delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}
