import type { ProducerSettings } from '@shared/models/producer-settings';
import type { ProducerWorkerResponse, SnapshotResponse } from '@shared/models/worker-protocol';
import { ProducerEngine } from './producer-engine';
import {
  Field,
  RECORD_FIELDS,
  generateBatch,
  initProducer,
  loadProducerWasm
} from './wasm-loader';

/**
 * The real compiled Wasm generator feeding the real engine and accumulator,
 * exactly as in the worker. Every record is also tallied here independently.
 */
describe('Wasm → engine → snapshot pipeline', () => {
  const settings: ProducerSettings = { instrumentCount: 7, updatesPerBatch: 1000, batchIntervalMs: 50 };
  const wasmUrl = new URL('market-producer.wasm', document.baseURI).href;

  interface Tally {
    volume: number;
    notional: number;
    lastPrice: number;
  }

  let posted: ProducerWorkerResponse[];
  let tally: Map<number, Tally>;
  let generated: number;
  let engine: ProducerEngine;

  beforeEach(() => {
    jasmine.clock().install();
    posted = [];
    tally = new Map();
    generated = 0;
    engine = new ProducerEngine({
      async createSource({ seed }) {
        const producer = await loadProducerWasm(wasmUrl);
        initProducer(producer, seed, settings.instrumentCount);
        return {
          generate(count) {
            const records = generateBatch(producer, count);
            for (let r = 0; r < records.length; r += RECORD_FIELDS) {
              const t = tally.get(records[r + Field.Instrument]) ?? { volume: 0, notional: 0, lastPrice: 0 };
              t.volume += records[r + Field.TradeQuantity];
              t.notional += records[r + Field.PriceCents] * records[r + Field.TradeQuantity];
              t.lastPrice = records[r + Field.PriceCents];
              tally.set(records[r + Field.Instrument], t);
              generated++;
            }
            return records;
          }
        };
      },
      post: (message) => posted.push(message)
    });
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('counts every generated trade exactly once', async () => {
    await engine.handle({ type: 'start', runId: 1, wasmUrl, settings, seed: 2024n });
    jasmine.clock().tick(1000); // 21 batches of 1000 updates
    await engine.handle({ type: 'pause', runId: 1 });

    const snapshot = posted.filter((m): m is SnapshotResponse => m.type === 'snapshot').at(-1)!;
    expect(generated).toBe(21_000);
    expect(snapshot.totalUpdates).toBe(generated);

    snapshot.instruments.forEach((metrics, i) => {
      const t = tally.get(i)!;
      expect(metrics.volume).withContext(metrics.symbol).toBe(t.volume);
      expect(metrics.vwapCents!).withContext(metrics.symbol).toBeCloseTo(t.notional / t.volume, 6);
      expect(metrics.lastPriceCents).withContext(metrics.symbol).toBe(t.lastPrice);
      expect(metrics.spreadCents!).withContext(metrics.symbol).toBeGreaterThan(0);
      if (metrics.imbalance !== null) {
        expect(Math.abs(metrics.imbalance)).withContext(metrics.symbol).toBeLessThanOrEqual(1);
      }
    });
  });
});
