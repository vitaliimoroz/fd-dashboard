import { emptyMetrics, instrumentSymbol } from '@shared/models/instrument-metrics';
import { MetricsAccumulator } from './metrics-accumulator';

interface TestUpdate {
  instrument: number;
  priceCents: number;
  tradeQuantity: number;
  bidCents: number;
  askCents: number;
  bidQuantity: number;
  askQuantity: number;
}

function records(...updates: TestUpdate[]): Uint32Array {
  return Uint32Array.from(
    updates.flatMap((u) => [
      u.instrument,
      u.priceCents,
      u.tradeQuantity,
      u.bidCents,
      u.askCents,
      u.bidQuantity,
      u.askQuantity
    ])
  );
}

const book = { bidCents: 10196, askCents: 10200, bidQuantity: 600, askQuantity: 400 };

describe('MetricsAccumulator', () => {
  it('reproduces the worked example from the brief', () => {
    const acc = new MetricsAccumulator(1);

    acc.apply(
      records(
        { instrument: 0, priceCents: 10000, tradeQuantity: 10, ...book },
        { instrument: 0, priceCents: 10200, tradeQuantity: 30, ...book }
      )
    );

    const [alfa] = acc.snapshot();
    expect(alfa.lastPriceCents).toBe(10200);
    expect(alfa.volume).toBe(40);
    expect(alfa.vwapCents).toBe(10150);
    expect(alfa.spreadCents).toBe(4);
    expect(alfa.imbalance).toBeCloseTo(0.2, 12);
  });

  it('accumulates across batches without double counting', () => {
    const acc = new MetricsAccumulator(1);

    acc.apply(records({ instrument: 0, priceCents: 10000, tradeQuantity: 10, ...book }));
    acc.snapshot();
    acc.apply(records({ instrument: 0, priceCents: 10200, tradeQuantity: 30, ...book }));

    expect(acc.snapshot()[0]).toEqual(
      jasmine.objectContaining({ volume: 40, vwapCents: 10150, lastPriceCents: 10200 })
    );
  });

  it('uses the latest book snapshot for spread and imbalance', () => {
    const acc = new MetricsAccumulator(1);

    acc.apply(
      records(
        { instrument: 0, priceCents: 10000, tradeQuantity: 1, ...book },
        {
          instrument: 0,
          priceCents: 10010,
          tradeQuantity: 1,
          bidCents: 10000,
          askCents: 10010,
          bidQuantity: 100,
          askQuantity: 300
        }
      )
    );

    const [metrics] = acc.snapshot();
    expect(metrics.spreadCents).toBe(10);
    expect(metrics.imbalance).toBe(-0.5);
  });

  it('shows unavailable values and zero volume before any data', () => {
    const acc = new MetricsAccumulator(2);

    expect(acc.snapshot()).toEqual(emptyMetrics(2));
    expect(emptyMetrics(1)[0]).toEqual({
      symbol: 'ASSET01',
      lastPriceCents: null,
      spreadCents: null,
      volume: 0,
      vwapCents: null,
      imbalance: null
    });
  });

  it('reports imbalance as unavailable when both book quantities are zero', () => {
    const acc = new MetricsAccumulator(1);

    acc.apply(
      records({ instrument: 0, priceCents: 10000, tradeQuantity: 5, ...book, bidQuantity: 0, askQuantity: 0 })
    );

    const [metrics] = acc.snapshot();
    expect(metrics.imbalance).toBeNull();
    expect(metrics.vwapCents).toBe(10000);
  });

  it('keeps instruments isolated from each other', () => {
    const acc = new MetricsAccumulator(3);

    acc.apply(
      records(
        { instrument: 0, priceCents: 10000, tradeQuantity: 10, ...book },
        { instrument: 2, priceCents: 5000, tradeQuantity: 4, bidCents: 4990, askCents: 5000, bidQuantity: 0, askQuantity: 50 },
        { instrument: 0, priceCents: 10200, tradeQuantity: 30, ...book }
      )
    );

    const [first, second, third] = acc.snapshot();
    expect(first).toEqual(jasmine.objectContaining({ volume: 40, vwapCents: 10150 }));
    expect(second).toEqual(emptyMetrics(3)[1]);
    expect(third).toEqual({
      symbol: 'ASSET03',
      lastPriceCents: 5000,
      spreadCents: 10,
      volume: 4,
      vwapCents: 5000,
      imbalance: -1
    });
  });

  it('rejects records for instruments outside the run', () => {
    const acc = new MetricsAccumulator(1);

    expect(() =>
      acc.apply(records({ instrument: 1, priceCents: 1, tradeQuantity: 1, ...book }))
    ).toThrowError(RangeError);
  });

  it('formats deterministic symbols', () => {
    expect(instrumentSymbol(0)).toBe('ASSET01');
    expect(instrumentSymbol(49)).toBe('ASSET50');
  });
});
