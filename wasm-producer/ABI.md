# Raw Wasm ABI (version 2)

The worker fetches `public/market-producer.wasm` and instantiates it directly;
there is no generated JavaScript glue and the module has no imports. The
TypeScript side of this contract lives in `src/worker/wasm-loader.ts`.

## Exports

| Export | Signature | Meaning |
|---|---|---|
| `memory` | `WebAssembly.Memory` | Linear memory holding the output buffer. |
| `abi_version` | `() -> u32` | Returns `2`. The loader rejects any other value. |
| `init` | `(seed_lo: u32, seed_hi: u32, instrument_count: u32) -> u32` | Starts a new run with a 64-bit seed and `1..=50` instruments. Returns `1` on success, `0` on an invalid count. The previous run is always discarded. |
| `generate` | `(update_count: u32) -> u32` | Generates `1..=1000` updates and returns the byte offset of the first record, or `0` if not initialized or the count is out of range. |
| `output_len` | `() -> u32` | Byte length of the last successful batch (`update_count × 28`), `0` after a failure. |

## Record layout

Each record is seven little-endian `u32` values, contiguous, exactly 28 bytes:

| Index | Field | Notes |
|---|---|---|
| 0 | `instrument` | `0..instrument_count`; the worker maps it to a symbol. |
| 1 | `priceCents` | Always equal to `bidCents` or `askCents`. |
| 2 | `tradeQuantity` | `1..=200`. |
| 3 | `bidCents` | `>= 1`. |
| 4 | `askCents` | `> bidCents`. |
| 5 | `bidQuantity` | `0..=2000`. |
| 6 | `askQuantity` | `0..=2000`. |

## Rules for callers

- Create the `Uint32Array` view over `memory.buffer` **after** `generate`
  returns. Memory growth detaches earlier views. The output buffer is
  preallocated for 1000 records, so growth is not expected, but callers must not
  rely on that.
- Copy the records before calling `generate` again: the buffer is reused.

## Generator model

Randomness (SplitMix64) and all price logic run in Rust:

- Each instrument keeps its mid price and book quantities between calls.
- Each update picks an instrument uniformly, so an instrument may appear more
  than once per batch.
- The mid price follows a random walk of at most ~0.1% (minimum 1 cent) per
  update, clamped to $1.00–$100,000.00.
- The spread is 1 cent up to ~0.05% of the mid. The bid is the mid minus half
  the spread and the ask is the bid plus the spread, so `1 <= bid < ask`.
- Book quantities drift by up to ±100 per update, clamped to `0..=2000`.
- The trade executes at the ask (buyer) or the bid (seller) with equal
  probability.
