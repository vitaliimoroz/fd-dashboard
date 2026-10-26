import { InstrumentMetrics, instrumentSymbol } from '@shared/models/instrument-metrics';
import { Field, RECORD_FIELDS } from './wasm-loader';

interface InstrumentTotals {
  hasTrades: boolean;
  lastPriceCents: number;
  volume: number;
  /** sum(priceCents × quantity), used for VWAP. */
  notionalCents: number;
  bidCents: number;
  askCents: number;
  bidQuantity: number;
  askQuantity: number;
}

/**
 * Running totals per instrument for one run. Each trade is added exactly once
 * and no event history is kept.
 */
export class MetricsAccumulator {
  private readonly totals: InstrumentTotals[];

  constructor(instrumentCount: number) {
    this.totals = Array.from({ length: instrumentCount }, () => ({
      hasTrades: false,
      lastPriceCents: 0,
      volume: 0,
      notionalCents: 0,
      bidCents: 0,
      askCents: 0,
      bidQuantity: 0,
      askQuantity: 0
    }));
  }

  /** Adds a batch of raw records (layout in wasm-producer/ABI.md). */
  apply(records: Uint32Array): void {
    for (let r = 0; r < records.length; r += RECORD_FIELDS) {
      const t = this.totals[records[r + Field.Instrument]];
      if (!t) {
        throw new RangeError(`Instrument index ${records[r + Field.Instrument]} is out of range.`);
      }
      const price = records[r + Field.PriceCents];
      const quantity = records[r + Field.TradeQuantity];

      t.hasTrades = true;
      t.lastPriceCents = price;
      t.volume += quantity;
      t.notionalCents += price * quantity;
      t.bidCents = records[r + Field.BidCents];
      t.askCents = records[r + Field.AskCents];
      t.bidQuantity = records[r + Field.BidQuantity];
      t.askQuantity = records[r + Field.AskQuantity];
    }
  }

  snapshot(): InstrumentMetrics[] {
    return this.totals.map((t, i) => {
      if (!t.hasTrades) {
        return {
          symbol: instrumentSymbol(i),
          lastPriceCents: null,
          spreadCents: null,
          volume: 0,
          vwapCents: null,
          imbalance: null
        };
      }
      const bookQuantity = t.bidQuantity + t.askQuantity;
      return {
        symbol: instrumentSymbol(i),
        lastPriceCents: t.lastPriceCents,
        spreadCents: t.askCents - t.bidCents,
        volume: t.volume,
        vwapCents: t.volume === 0 ? null : t.notionalCents / t.volume,
        imbalance: bookQuantity === 0 ? null : (t.bidQuantity - t.askQuantity) / bookQuantity
      };
    });
  }
}
