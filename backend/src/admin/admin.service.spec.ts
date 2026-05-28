const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'queued-job-id' });
const mockQueueGetJob = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: (...args: unknown[]) => mockQueueAdd(...args),
    getJob: (...args: unknown[]) => mockQueueGetJob(...args),
  })),
}));

jest.mock('../redis/client', () => ({
  getBullMQConnection: () => ({}),
}));

import { AdminService } from './admin.service';

describe('AdminService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd.mockResolvedValue({ id: 'queued-job-id' });
  });

  describe('enqueueReindex', () => {
    it('sets last_processed_ledger to fromLedger-1 and enqueues with network', async () => {
      const upsert = jest.fn();
      const progressUpsert = jest.fn();
      const prisma = {
        $transaction: jest.fn(async (fn: (t: { ledgerCursor: { upsert: jest.Mock } }) => Promise<void>) =>
          fn({ ledgerCursor: { upsert } })),
        reindexProgress: { upsert: progressUpsert },
      };

      const svc = new AdminService(prisma as never, { refreshFlags: jest.fn() } as never);
      const jobId = await svc.enqueueReindex(500, 'testnet');

      expect(jobId).toBe('queued-job-id');
      expect(upsert).toHaveBeenCalledWith({
        where: { network: 'testnet' },
        create: { network: 'testnet', lastProcessedLedger: 499 },
        update: { lastProcessedLedger: 499 },
      });
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'reindex',
        { fromLedger: 500, network: 'testnet' },
        expect.objectContaining({
          jobId: expect.stringMatching(/^reindex-testnet-500-/),
        }),
      );
      expect(progressUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: 'queued-job-id' },
          create: expect.objectContaining({ network: 'testnet', status: 'running' }),
        }),
      );
    });

    it('clamps at 0 when fromLedger is 0', async () => {
      const upsert = jest.fn();
      const prisma = {
        $transaction: jest.fn(async (fn: (t: { ledgerCursor: { upsert: jest.Mock } }) => Promise<void>) =>
          fn({ ledgerCursor: { upsert } })),
        reindexProgress: { upsert: jest.fn() },
      };
      const svc = new AdminService(prisma as never, { refreshFlags: jest.fn() } as never);
      await svc.enqueueReindex(0, 'public');
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ lastProcessedLedger: 0 }),
        }),
      );
    });
  });

  describe('enqueueBackfill', () => {
    function makeSvc() {
      const prisma = { $transaction: jest.fn() };
      return new AdminService(prisma as never, { refreshFlags: jest.fn() } as never);
    }

    it('enqueues one job when range fits in a single batch', async () => {
      let callCount = 0;
      mockQueueAdd.mockImplementation(() => Promise.resolve({ id: `job-${++callCount}` }));

      const svc = makeSvc();
      const jobs = await svc.enqueueBackfill(100, 149, 'testnet', 50);

      expect(jobs).toHaveLength(1);
      expect(jobs[0]).toMatchObject({ fromLedger: 100, toLedger: 149, batchSize: 50 });
      expect(mockQueueAdd).toHaveBeenCalledWith(
        'backfill',
        { fromLedger: 100, toLedger: 149, network: 'testnet', batchSize: 50 },
        expect.objectContaining({ jobId: expect.stringMatching(/^backfill-testnet-100-149-/) }),
      );
    });

    it('splits range into multiple batches', async () => {
      let callCount = 0;
      mockQueueAdd.mockImplementation(() => Promise.resolve({ id: `job-${++callCount}` }));

      const svc = makeSvc();
      const jobs = await svc.enqueueBackfill(100, 249, 'testnet', 50);

      expect(jobs).toHaveLength(3);
      expect(jobs[0]).toMatchObject({ fromLedger: 100, toLedger: 149 });
      expect(jobs[1]).toMatchObject({ fromLedger: 150, toLedger: 199 });
      expect(jobs[2]).toMatchObject({ fromLedger: 200, toLedger: 249 });
    });

    it('handles partial last batch correctly', async () => {
      let callCount = 0;
      mockQueueAdd.mockImplementation(() => Promise.resolve({ id: `job-${++callCount}` }));

      const svc = makeSvc();
      const jobs = await svc.enqueueBackfill(100, 160, 'testnet', 50);

      expect(jobs).toHaveLength(2);
      expect(jobs[0]).toMatchObject({ fromLedger: 100, toLedger: 149 });
      expect(jobs[1]).toMatchObject({ fromLedger: 150, toLedger: 160 });
    });

    it('does NOT mutate the ledger cursor', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-1' });
      const prisma = { $transaction: jest.fn() };
      const svc = new AdminService(prisma as never, { refreshFlags: jest.fn() } as never);
      await svc.enqueueBackfill(100, 149, 'testnet', 50);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('getBackfillJob', () => {
    function makeSvc() {
      const prisma = { $transaction: jest.fn() };
      return new AdminService(prisma as never, { refreshFlags: jest.fn() } as never);
    }

    it('returns null when job not found', async () => {
      mockQueueGetJob.mockResolvedValue(null);
      const svc = makeSvc();
      const result = await svc.getBackfillJob('nonexistent');
      expect(result).toBeNull();
    });

    it('returns job state details when found', async () => {
      const mockJob = {
        id: 'backfill-testnet-100-149-123-0',
        data: { fromLedger: 100, toLedger: 149, network: 'testnet', batchSize: 50 },
        progress: 0,
        failedReason: undefined,
        finishedOn: undefined,
        processedOn: undefined,
        getState: jest.fn().mockResolvedValue('completed'),
      };
      mockQueueGetJob.mockResolvedValue(mockJob);

      const svc = makeSvc();
      const result = await svc.getBackfillJob('backfill-testnet-100-149-123-0');

      expect(result).toMatchObject({
        jobId: 'backfill-testnet-100-149-123-0',
        state: 'completed',
        data: { fromLedger: 100, toLedger: 149 },
      });
    });
  });

  describe('getReindexStatus', () => {
    function makeSvcWithProgress(row: unknown) {
      const prisma = {
        $transaction: jest.fn(),
        reindexProgress: {
          upsert: jest.fn(),
          findFirst: jest.fn().mockResolvedValue(row),
        },
      };
      return new AdminService(prisma as never, { refreshFlags: jest.fn() } as never);
    }

    it('returns null when no progress row exists', async () => {
      const svc = makeSvcWithProgress(null);
      expect(await svc.getReindexStatus('testnet')).toBeNull();
    });

    it('calculates percentage correctly', async () => {
      const svc = makeSvcWithProgress({
        jobId: 'j1', network: 'testnet',
        startLedger: 500, targetLedger: 1000, currentLedger: 750,
        status: 'running', startTime: new Date('2026-01-01'),
      });
      const result = await svc.getReindexStatus('testnet');
      expect(result?.percentage).toBe(50);
      expect(result?.status).toBe('running');
    });

    it('returns 100% when startLedger equals targetLedger', async () => {
      const svc = makeSvcWithProgress({
        jobId: 'j2', network: 'testnet',
        startLedger: 1000, targetLedger: 1000, currentLedger: 1000,
        status: 'completed', startTime: new Date(),
      });
      const result = await svc.getReindexStatus('testnet');
      expect(result?.percentage).toBe(100);
    });
  });
});
