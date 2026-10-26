# Raw Wasm ABI

The worker fetches `public/market-producer.wasm` and instantiates it directly;
there is no generated JavaScript glue.

The initial integration probe exports `abi_version() -> u32` and
`probe(input: u32) -> u32`. The generator implementation will extend this
versioned ABI with:

- `init(seed: u32, instrument_count: u32) -> ()`
- `generate(update_count: u32) -> u32`, returning the byte offset of the output
  buffer in exported Wasm memory
- `output_len() -> u32`, returning the buffer length in bytes

Each output record is seven little-endian `u32` values in this order:
`instrumentIndex`, `priceCents`, `tradeQuantity`, `bidCents`, `askCents`,
`bidQuantity`, and `askQuantity`. Records are contiguous and exactly 28 bytes.
The worker copies the reported bytes before requesting another batch, because
the generator may reuse its output buffer. The instrument index maps to the
stable symbol list in the worker.
