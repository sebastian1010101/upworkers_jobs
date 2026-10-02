import { ConfigService } from '@nestjs/config';
import { JobService } from '../jobs/job.service';
import { UpworkRetentionScheduler } from './upwork-retention.scheduler';

describe('UpworkRetentionScheduler', () => {
  const config = { getOrThrow: () => 15 } as unknown as ConfigService;

  it('purges expired jobs on startup and stops its timer on shutdown', async () => {
    const deleteExpiredUpwork = jest.fn().mockResolvedValue(0);
    const scheduler = new UpworkRetentionScheduler({ deleteExpiredUpwork } as unknown as JobService, config);

    await scheduler.onModuleInit();
    expect(deleteExpiredUpwork).toHaveBeenCalledTimes(1);
    scheduler.onModuleDestroy();
  });

  it('coalesces concurrent cleanup requests and permits another run afterward', async () => {
    let finish!: (count: number) => void;
    const deleteExpiredUpwork = jest.fn()
      .mockImplementationOnce(() => new Promise<number>((resolve) => { finish = resolve; }))
      .mockResolvedValueOnce(0);
    const scheduler = new UpworkRetentionScheduler({ deleteExpiredUpwork } as unknown as JobService, config);

    const first = scheduler.purgeExpired();
    const second = scheduler.purgeExpired();
    expect(deleteExpiredUpwork).toHaveBeenCalledTimes(1);
    finish(1);
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(1);
    await expect(scheduler.purgeExpired()).resolves.toBe(0);
    expect(deleteExpiredUpwork).toHaveBeenCalledTimes(2);
  });

  it('retries on the next call after a cleanup error', async () => {
    const deleteExpiredUpwork = jest.fn()
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce(0);
    const scheduler = new UpworkRetentionScheduler({ deleteExpiredUpwork } as unknown as JobService, config);

    await expect(scheduler.purgeExpired()).rejects.toThrow('database unavailable');
    await expect(scheduler.purgeExpired()).resolves.toBe(0);
  });
});
