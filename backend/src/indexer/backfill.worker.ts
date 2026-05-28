import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker, Job } from 'bullmq';
import { getBullMQConnection } from '../redis/client';
import { IndexerService } from './indexer.service';
import { getRuntimeEnv } from '../config/runtime-env';

interface BackfillJobData {
  fromLedger: number;
  toLedger: number;
  network: string;
  batchSize: number;
}

/**
 * BackfillWorkerService — BullMQ consumer for `backfill` queue jobs.
 *
 * Each job covers a sub-range [fromLedger, toLedger] produced by the admin
 * backfill endpoint. The worker replays events through the existing
 * IndexerService which uses upsert logic throughout, so re-processing
 * already-indexed ledgers is a safe no-op.
 */
@Injectable()
export class BackfillWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackfillWorkerService.name);
  private worker?: Worker;

  constructor(private readonly indexer: IndexerService) {}

  onModuleInit(): void {
    const env = getRuntimeEnv();
    if (env.NODE_ENV === 'test' || env.DISABLE_REINDEX_WORKER === '1') {
      this.logger.log('Backfill BullMQ worker disabled (test or DISABLE_REINDEX_WORKER)');
      return;
    }
    try {
      this.worker = new Worker(
        'backfill',
        async (job: Job) => {
          await this.processBackfillJob(job);
        },
        { connection: getBullMQConnection(), concurrency: 2 },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Backfill job ${job?.id} failed: ${err?.message}`, err?.stack);
      });

      this.worker.on('completed', (job) => {
        this.logger.log(`Backfill job ${job.id} completed`);
      });
    } catch (err) {
      this.logger.warn(`Backfill worker not started: ${String(err)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }

  private async processBackfillJob(job: Job): Promise<void> {
    const { fromLedger, toLedger, network } = job.data as BackfillJobData;
    this.logger.log(`Backfill job ${job.id}: ledgers ${fromLedger}–${toLedger} on ${network}`);

    let ledger = fromLedger;
    while (ledger <= toLedger) {
      const result = await this.indexer.processNextBatchForNetwork(network);
      if (result.processed === 0) {
        // No more events in this range — advance past it
        break;
      }
      ledger += result.processed;
    }

    this.logger.log(`Backfill job ${job.id} done: ledgers ${fromLedger}–${toLedger}`);
  }
}
