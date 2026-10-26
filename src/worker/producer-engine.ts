import { errorMessage } from '@shared/error-message';
import type { ProducerSettings } from '@shared/models/producer-settings';
import type {
  ProducerWorkerRequest,
  ProducerWorkerResponse,
  StartRequest
} from '@shared/models/worker-protocol';
import { MetricsAccumulator } from './metrics-accumulator';
import { RECORD_FIELDS } from './wasm-loader';

/** How often the UI receives a snapshot. Every batch is still aggregated in between. */
export const SNAPSHOT_INTERVAL_MS = 100;

export interface BatchSource {
  generate(updateCount: number): Uint32Array;
}

/** What the engine needs from the outside world; tests pass fakes. */
export interface EngineDeps {
  createSource(start: StartRequest): Promise<BatchSource>;
  post(message: ProducerWorkerResponse): void;
}

interface Run {
  settings: ProducerSettings;
  source: BatchSource;
  metrics: MetricsAccumulator;
}

/** Runs a single producer run inside the worker. */
export class ProducerEngine {
  private runId = 0;
  private run?: Run;
  private totalUpdates = 0;
  private paused = false;
  private failed = false;
  private changed = false;
  private batchTimer?: ReturnType<typeof setTimeout>;
  private snapshotTimer?: ReturnType<typeof setInterval>;

  constructor(private readonly deps: EngineDeps) {}

  async handle(message: ProducerWorkerRequest): Promise<void> {
    switch (message.type) {
      case 'start':
        await this.start(message);
        break;
      case 'pause':
        this.pause();
        break;
      case 'resume':
        this.resume();
        break;
    }
  }

  private async start(message: StartRequest): Promise<void> {
    this.runId = message.runId;

    let source: BatchSource;
    try {
      source = await this.deps.createSource(message);
    } catch (error) {
      this.fail(errorMessage(error, 'Unknown Wasm initialization error.'));
      return;
    }

    const { settings } = message;
    this.run = { settings, source, metrics: new MetricsAccumulator(settings.instrumentCount) };
    this.deps.post({ type: 'ready', runId: this.runId });
    this.snapshotTimer = setInterval(() => this.postSnapshot(), SNAPSHOT_INTERVAL_MS);

    // A pause may have arrived while the Wasm module was loading.
    if (!this.paused) {
      this.runBatch();
    }
  }

  private pause(): void {
    this.paused = true;
    clearTimeout(this.batchTimer);
    // Send the latest totals now so the paused dashboard is complete.
    this.postSnapshot();
  }

  private resume(): void {
    if (!this.paused) {
      return;
    }
    this.paused = false;
    // No catch-up for the paused time: just continue from now.
    this.runBatch();
  }

  private runBatch(): void {
    if (!this.run || this.paused || this.failed) {
      return;
    }
    const { settings, source, metrics } = this.run;

    try {
      const records = source.generate(settings.updatesPerBatch);
      metrics.apply(records);
      this.totalUpdates += records.length / RECORD_FIELDS;
      this.changed = true;
    } catch (error) {
      this.fail(errorMessage(error, 'Unknown generator error.'));
      return;
    }

    // Scheduled only after this batch is done, so batches never overlap.
    this.batchTimer = setTimeout(() => this.runBatch(), settings.batchIntervalMs);
  }

  private postSnapshot(): void {
    if (!this.run || !this.changed) {
      return;
    }
    this.changed = false;
    this.deps.post({
      type: 'snapshot',
      runId: this.runId,
      instruments: this.run.metrics.snapshot(),
      totalUpdates: this.totalUpdates
    });
  }

  private fail(message: string): void {
    this.failed = true;
    clearTimeout(this.batchTimer);
    this.postSnapshot();
    clearInterval(this.snapshotTimer);
    this.deps.post({ type: 'error', runId: this.runId, message });
  }
}
