/** Dashboard metrics for one instrument. `null` means "unavailable". Prices are in cents. */
export interface InstrumentMetrics {
  symbol: string;
  lastPriceCents: number | null;
  spreadCents: number | null;
  volume: number;
  vwapCents: number | null;
  imbalance: number | null;
}

export function instrumentSymbol(index: number): string {
  return `ASSET${String(index + 1).padStart(2, '0')}`;
}

export function emptyMetrics(instrumentCount: number): InstrumentMetrics[] {
  return Array.from({ length: instrumentCount }, (_, i) => ({
    symbol: instrumentSymbol(i),
    lastPriceCents: null,
    spreadCents: null,
    volume: 0,
    vwapCents: null,
    imbalance: null
  }));
}
