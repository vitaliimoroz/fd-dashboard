import { TestBed } from '@angular/core/testing';
import { emptyMetrics } from '@shared/models/instrument-metrics';
import { DEFAULT_SETTINGS, ProducerSettings } from '@shared/models/producer-settings';
import type {
  ProducerWorkerRequest,
  ProducerWorkerResponse
} from '@shared/models/worker-protocol';
import { PRODUCER_WORKER_FACTORY, ProducerService, ProducerWorker } from './producer.service';

class FakeWorker implements ProducerWorker {
  readonly sent: ProducerWorkerRequest[] = [];
  terminated = false;
  onmessage: Worker['onmessage'] = null;
  onerror: Worker['onerror'] = null;

  postMessage(message: ProducerWorkerRequest): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  get runId(): number {
    return this.sent[0].runId;
  }

  /** Simulates a message from the worker, even after termination (already queued). */
  emit(message: ProducerWorkerResponse): void {
    this.onmessage?.call(this as unknown as Worker, new MessageEvent('message', { data: message }));
  }

  emitReady(): void {
    this.emit({ type: 'ready', runId: this.runId });
  }

  emitSnapshot(totalUpdates: number, runId = this.runId): void {
    const instruments = emptyMetrics(1).map((m) => ({ ...m, volume: totalUpdates }));
    this.emit({ type: 'snapshot', runId, instruments, totalUpdates });
  }
}

describe('ProducerService', () => {
  let workers: FakeWorker[];
  let service: ProducerService;
  const latest = () => workers.at(-1)!;
  const custom: ProducerSettings = { instrumentCount: 3, updatesPerBatch: 50, batchIntervalMs: 100 };

  let workerFactoryError: Error | undefined;

  beforeEach(() => {
    workers = [];
    workerFactoryError = undefined;
    TestBed.configureTestingModule({
      providers: [
        {
          provide: PRODUCER_WORKER_FACTORY,
          useValue: () => {
            if (workerFactoryError) {
              throw workerFactoryError;
            }
            const worker = new FakeWorker();
            workers.push(worker);
            return worker;
          }
        }
      ]
    });
    service = TestBed.inject(ProducerService);
  });

  it('starts one run with the default settings', () => {
    expect(workers.length).toBe(1);
    expect(latest().sent).toEqual([
      jasmine.objectContaining({ type: 'start', settings: DEFAULT_SETTINGS })
    ]);
    expect(service.settings()).toEqual(DEFAULT_SETTINGS);
    expect(service.status()).toBe('initializing');
    expect(service.instruments()).toEqual(emptyMetrics(5));
    expect(service.totalUpdates()).toBe(0);
  });

  it('becomes running when the worker is ready and shows snapshots', () => {
    latest().emitReady();
    latest().emitSnapshot(100);

    expect(service.status()).toBe('running');
    expect(service.totalUpdates()).toBe(100);
    expect(service.instruments()[0].volume).toBe(100);
  });

  it('pauses and resumes the current run without resetting totals', () => {
    latest().emitReady();
    latest().emitSnapshot(100);

    service.pause();
    expect(service.status()).toBe('paused');
    expect(latest().sent.at(-1)).toEqual({ type: 'pause', runId: latest().runId });

    service.resume();
    expect(service.status()).toBe('running');
    expect(latest().sent.at(-1)).toEqual({ type: 'resume', runId: latest().runId });
    expect(service.totalUpdates()).toBe(100);
    expect(workers.length).toBe(1);
  });

  it('keeps a pause requested during initialization', () => {
    service.pause();
    latest().emitReady();

    expect(service.status()).toBe('paused');
  });

  it('applies settings by replacing the worker and clearing previous values', () => {
    const first = latest();
    first.emitReady();
    first.emitSnapshot(100);

    service.apply(custom);

    expect(first.terminated).toBeTrue();
    expect(workers.length).toBe(2);
    expect(latest().runId).toBeGreaterThan(first.runId);
    expect(latest().sent[0]).toEqual(jasmine.objectContaining({ type: 'start', settings: custom }));
    expect(service.settings()).toEqual(custom);
    expect(service.instruments()).toEqual(emptyMetrics(3));
    expect(service.totalUpdates()).toBe(0);
    expect(service.status()).toBe('initializing');
  });

  it('starts generating after Apply even when the previous run was paused', () => {
    latest().emitReady();
    service.pause();

    service.apply(custom);
    latest().emitReady();

    expect(service.status()).toBe('running');
    expect(latest().sent.map((m) => m.type)).toEqual(['start']);
  });

  it('ignores messages from a previous run', () => {
    const first = latest();
    first.emitReady();
    service.apply(custom);
    latest().emitReady();
    latest().emitSnapshot(10);

    // Messages already queued by the replaced worker arrive late.
    first.emitSnapshot(999);
    first.emit({ type: 'error', runId: first.runId, message: 'stale failure' });

    expect(service.totalUpdates()).toBe(10);
    expect(service.status()).toBe('running');
  });

  it('ignores messages tagged with another run id', () => {
    latest().emitReady();
    latest().emitSnapshot(5);

    latest().emitSnapshot(999, latest().runId - 1);

    expect(service.totalUpdates()).toBe(5);
  });

  it('reports initialization errors from the worker', () => {
    latest().emit({ type: 'error', runId: latest().runId, message: 'Failed to fetch: HTTP 404.' });

    expect(service.status()).toBe('error');
    expect(service.error()).toBe('Failed to fetch: HTTP 404.');
  });

  it('reports worker script failures', () => {
    const event = new ErrorEvent('error', { message: 'SyntaxError', cancelable: true });

    latest().onerror?.call(latest() as unknown as Worker, event);

    expect(service.status()).toBe('error');
    expect(service.error()).toContain('SyntaxError');
  });

  it('explains a worker script that failed to load without a message', () => {
    latest().onerror?.call(latest() as unknown as Worker, new ErrorEvent('error', { cancelable: true }));

    expect(service.error()).toBe('Producer worker failed: the script could not be loaded.');
  });

  it('reports a worker that cannot be created', () => {
    workerFactoryError = new Error('Workers are not supported.');

    service.apply(custom);

    expect(service.status()).toBe('error');
    expect(service.error()).toBe('Could not start the producer worker: Workers are not supported.');
    expect(service.settings()).toEqual(custom);
  });

  it('goes back to initializing when resumed before the worker is ready', () => {
    service.pause();

    service.resume();

    expect(service.status()).toBe('initializing');
    latest().emitReady();
    expect(service.status()).toBe('running');
  });

  it('clears the error when settings are applied again', () => {
    latest().emit({ type: 'error', runId: latest().runId, message: 'boom' });

    service.apply(custom);

    expect(service.error()).toBeNull();
    expect(service.status()).toBe('initializing');
  });

  it('terminates the worker when the application is destroyed', () => {
    const worker = latest();

    TestBed.resetTestingModule();

    expect(worker.terminated).toBeTrue();
  });
});
