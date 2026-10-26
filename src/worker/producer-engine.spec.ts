import type { ProducerSettings } from '@shared/models/producer-settings';
import type {
  ProducerWorkerResponse,
  SnapshotResponse,
  StartRequest
} from '@shared/models/worker-protocol';
import { BatchSource, ProducerEngine, SNAPSHOT_INTERVAL_MS } from './producer-engine';

/** Every update trades 1 unit at 100 cents, cycling through the instruments. */
class FakeSource implements BatchSource {
  calls = 0;
  failWith?: Error;

  constructor(private readonly instrumentCount: number) {}

  generate(updateCount: number): Uint32Array {
    this.calls++;
    if (this.failWith) {
      throw this.failWith;
    }
    const records: number[] = [];
    for (let k = 0; k < updateCount; k++) {
      records.push(k % this.instrumentCount, 100, 1, 99, 100, 10, 10);
    }
    return Uint32Array.from(records);
  }
}

describe('ProducerEngine', () => {
  const settings: ProducerSettings = { instrumentCount: 2, updatesPerBatch: 10, batchIntervalMs: 500 };
  let source: FakeSource;
  let posted: ProducerWorkerResponse[];
  let createSource: jasmine.Spy<(start: StartRequest) => Promise<BatchSource>>;
  let engine: ProducerEngine;

  const start = (overrides: Partial<ProducerSettings> = {}) =>
    engine.handle({
      type: 'start',
      runId: 7,
      wasmUrl: 'producer.wasm',
      settings: { ...settings, ...overrides },
      seed: 1n
    });
  const pause = () => engine.handle({ type: 'pause', runId: 7 });
  const resume = () => engine.handle({ type: 'resume', runId: 7 });
  const snapshots = () => posted.filter((m): m is SnapshotResponse => m.type === 'snapshot');
  const lastSnapshot = () => snapshots().at(-1)!;

  beforeEach(() => {
    jasmine.clock().install();
    source = new FakeSource(settings.instrumentCount);
    posted = [];
    createSource = jasmine.createSpy('createSource').and.callFake(() => Promise.resolve(source));
    engine = new ProducerEngine({ createSource, post: (message) => posted.push(message) });
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('reports ready, generates the first batch immediately and posts a snapshot', async () => {
    await start();

    expect(posted[0]).toEqual({ type: 'ready', runId: 7 });
    expect(source.calls).toBe(1);

    jasmine.clock().tick(SNAPSHOT_INTERVAL_MS);

    expect(lastSnapshot().runId).toBe(7);
    expect(lastSnapshot().totalUpdates).toBe(10);
    expect(lastSnapshot().instruments.map((i) => i.volume)).toEqual([5, 5]);
  });

  it('generates one batch per interval', async () => {
    await start();

    jasmine.clock().tick(1000);

    expect(source.calls).toBe(3); // t = 0, 500, 1000
  });

  it('sends fewer snapshots than batches but never drops a trade', async () => {
    await start({ batchIntervalMs: 50 });

    jasmine.clock().tick(1000);
    await pause(); // flushes the latest totals

    expect(source.calls).toBe(21); // t = 0, 50, ..., 1000
    expect(snapshots().length).toBeLessThanOrEqual(11);
    expect(lastSnapshot().totalUpdates).toBe(210);
    const volume = lastSnapshot().instruments.reduce((sum, i) => sum + i.volume, 0);
    expect(volume).toBe(210);
  });

  it('posts the latest totals on pause and stops generating', async () => {
    await start();
    jasmine.clock().tick(450); // first snapshot sent at t=100
    jasmine.clock().tick(50); // second batch at t=500, not yet sent

    await pause();

    expect(lastSnapshot().totalUpdates).toBe(20);
    const postsAtPause = posted.length;

    jasmine.clock().tick(10_000);

    expect(source.calls).toBe(2);
    expect(posted.length).toBe(postsAtPause);
  });

  it('resumes without catching up on the paused time and keeps totals', async () => {
    await start();
    await pause();
    jasmine.clock().tick(10_000);

    await resume();

    expect(source.calls).toBe(2); // one batch on resume, none for the paused 10 s
    jasmine.clock().tick(SNAPSHOT_INTERVAL_MS);
    expect(lastSnapshot().totalUpdates).toBe(20);

    jasmine.clock().tick(400);
    expect(source.calls).toBe(3);
  });

  it('ignores resume while already running', async () => {
    await start();

    await resume();

    expect(source.calls).toBe(1);
  });

  it('respects a pause that arrives while the Wasm module is loading', async () => {
    let resolveSource!: (source: BatchSource) => void;
    createSource.and.returnValue(new Promise((resolve) => (resolveSource = resolve)));

    const started = start();
    await pause();
    resolveSource(source);
    await started;

    expect(posted).toEqual([{ type: 'ready', runId: 7 }]);
    expect(source.calls).toBe(0);

    await resume();
    expect(source.calls).toBe(1);
  });

  it('reports initialization errors and does not become ready', async () => {
    createSource.and.returnValue(Promise.reject(new Error('Failed to fetch producer.wasm: HTTP 404.')));

    await start();

    expect(posted).toEqual([
      { type: 'error', runId: 7, message: 'Failed to fetch producer.wasm: HTTP 404.' }
    ]);
  });

  it('reports generator errors and stops generating', async () => {
    await start();
    source.failWith = new Error('boom');

    jasmine.clock().tick(500);

    expect(posted.at(-1)).toEqual({ type: 'error', runId: 7, message: 'boom' });
    jasmine.clock().tick(5_000);
    expect(source.calls).toBe(2);
  });
});
