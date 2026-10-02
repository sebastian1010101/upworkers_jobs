import { retry } from './retry';

describe('retry', () => {
  it('retries transient failures and returns the eventual result', async () => {
    const operation = jest.fn()
      .mockRejectedValueOnce(new Error('temporary'))
      .mockResolvedValue('ok');
    const onRetry = jest.fn();

    await expect(retry(operation, {
      attempts: 3,
      baseDelayMs: 0,
      shouldRetry: () => true,
      onRetry,
    })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1, delayMs: 0 }));
  });

  it('does not retry permanent failures', async () => {
    const operation = jest.fn().mockRejectedValue(new Error('permanent'));
    await expect(retry(operation, {
      attempts: 3,
      baseDelayMs: 0,
      shouldRetry: () => false,
    })).rejects.toThrow('permanent');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
