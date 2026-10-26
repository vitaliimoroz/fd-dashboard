import { DestroyRef, Injectable, InjectionToken, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { errorMessage } from '@shared/error-message';
import { InstrumentMetrics, emptyMetrics } from '@shared/models/instrument-metrics';
import { DEFAULT_SETTINGS, ProducerSettings } from '@shared/models/producer-settings';
import type {
  ProducerWorkerRequest,
  ProducerWorkerResponse
} from '@shared/models/worker-protocol';

export type ProducerStatus = 'initializing' | 'running' | 'paused' | 'error';

/** The part of `Worker` the service uses, so tests can pass a fake. */
export type ProducerWorker = Pick<Worker, 'postMessage' | 'terminate' | 'onmessage' | 'onerror'>;

export const PRODUCER_WORKER_FACTORY = new InjectionToken<() => ProducerWorker>(
  'PRODUCER_WORKER_FACTORY',
  {
    providedIn: 'root',
    factory: () => () =>
      new Worker(new URL('../../worker/producer.worker', import.meta.url), { type: 'module' })
  }
);

/**
 * Owns the producer worker for the whole app session, so navigating between
 * pages keeps the run. Each Apply replaces the worker with a new run.
 */
@Injectable({ providedIn: 'root' })
export class ProducerService {
  private readonly createWorker = inject(PRODUCER_WORKER_FACTORY);
  private readonly wasmUrl = new URL('market-producer.wasm', inject(DOCUMENT).baseURI).href;

  private worker?: ProducerWorker;
  private runId = 0;
  private ready = false;

  readonly settings = signal<ProducerSettings>(DEFAULT_SETTINGS);
  readonly status = signal<ProducerStatus>('initializing');
  readonly error = signal<string | null>(null);
  readonly instruments = signal<InstrumentMetrics[]>([]);
  readonly totalUpdates = signal(0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.worker?.terminate());
    this.apply(DEFAULT_SETTINGS);
  }

  /** Starts a new running run with `settings` and clears the previous run's values. */
  apply(settings: ProducerSettings): void {
    this.worker?.terminate();
    this.runId++;
    this.ready = false;

    this.settings.set({ ...settings });
    this.status.set('initializing');
    this.error.set(null);
    this.instruments.set(emptyMetrics(settings.instrumentCount));
    this.totalUpdates.set(0);

    try {
      this.worker = this.createWorker();
    } catch (error) {
      this.fail(`Could not start the producer worker: ${errorMessage(error)}`);
      return;
    }
    this.worker.onmessage = ({ data }: MessageEvent<ProducerWorkerResponse>) => this.handle(data);
    this.worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      this.fail(`Producer worker failed: ${event.message || 'the script could not be loaded.'}`);
    };
    this.post({
      type: 'start',
      runId: this.runId,
      wasmUrl: this.wasmUrl,
      settings: { ...settings },
      seed: randomSeed()
    });
  }

  pause(): void {
    if (this.status() === 'running' || this.status() === 'initializing') {
      this.status.set('paused');
      this.post({ type: 'pause', runId: this.runId });
    }
  }

  resume(): void {
    if (this.status() === 'paused') {
      this.status.set(this.ready ? 'running' : 'initializing');
      this.post({ type: 'resume', runId: this.runId });
    }
  }

  private handle(message: ProducerWorkerResponse): void {
    // A replaced worker may still deliver queued messages; they belong to an old run.
    if (message.runId !== this.runId) {
      return;
    }
    switch (message.type) {
      case 'ready':
        this.ready = true;
        if (this.status() === 'initializing') {
          this.status.set('running');
        }
        break;
      case 'snapshot':
        this.instruments.set(message.instruments);
        this.totalUpdates.set(message.totalUpdates);
        break;
      case 'error':
        this.fail(message.message);
        break;
    }
  }

  private fail(message: string): void {
    this.status.set('error');
    this.error.set(message);
  }

  private post(message: ProducerWorkerRequest): void {
    this.worker?.postMessage(message);
  }
}

function randomSeed(): bigint {
  const [lo, hi] = crypto.getRandomValues(new Uint32Array(2));
  return (BigInt(hi) << 32n) | BigInt(lo);
}
