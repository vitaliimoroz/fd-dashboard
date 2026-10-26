export const EXPECTED_ABI_VERSION = 2;

/** Seven little-endian u32 fields per record; see wasm-producer/ABI.md. */
export const RECORD_FIELDS = 7;
export const RECORD_BYTES = RECORD_FIELDS * 4;

/** Field offsets within a record. */
export const Field = {
  Instrument: 0,
  PriceCents: 1,
  TradeQuantity: 2,
  BidCents: 3,
  AskCents: 4,
  BidQuantity: 5,
  AskQuantity: 6
} as const;

export interface ProducerExports {
  memory: WebAssembly.Memory;
  abi_version(): number;
  init(seedLo: number, seedHi: number, instrumentCount: number): number;
  generate(updateCount: number): number;
  output_len(): number;
}

/**
 * Fetches and instantiates the producer module, falling back to a buffered
 * instantiate when the server does not send `application/wasm`.
 */
export async function loadProducerWasm(
  wasmUrl: string,
  fetchFn: typeof fetch = fetch
): Promise<ProducerExports> {
  const response = await fetchFn(wasmUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${wasmUrl}: HTTP ${response.status}.`);
  }

  let instance: WebAssembly.Instance;
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.startsWith('application/wasm') && WebAssembly.instantiateStreaming) {
    ({ instance } = await WebAssembly.instantiateStreaming(response, {}));
  } else {
    ({ instance } = await WebAssembly.instantiate(await response.arrayBuffer(), {}));
  }

  const exports = instance.exports as Partial<ProducerExports>;
  if (
    !(exports.memory instanceof WebAssembly.Memory) ||
    typeof exports.abi_version !== 'function' ||
    typeof exports.init !== 'function' ||
    typeof exports.generate !== 'function' ||
    typeof exports.output_len !== 'function'
  ) {
    throw new Error('The Wasm module is missing required exports.');
  }

  const abiVersion = exports.abi_version();
  if (abiVersion !== EXPECTED_ABI_VERSION) {
    throw new Error(
      `Unsupported Wasm ABI version ${abiVersion}; expected ${EXPECTED_ABI_VERSION}.`
    );
  }

  return exports as ProducerExports;
}

/** Starts a new generator run; `seed` is split into two u32 halves. */
export function initProducer(producer: ProducerExports, seed: bigint, instrumentCount: number): void {
  const lo = Number(BigInt.asUintN(32, seed));
  const hi = Number(BigInt.asUintN(32, seed >> 32n));
  if (producer.init(lo, hi, instrumentCount) !== 1) {
    throw new Error(`Invalid instrument count ${instrumentCount}.`);
  }
}

/**
 * Generates one batch and returns a copy of its records. The view over
 * `memory.buffer` is created after `generate` returns, because memory growth
 * detaches previously created views; the copy is needed because the next
 * call reuses the output buffer.
 */
export function generateBatch(producer: ProducerExports, updateCount: number): Uint32Array {
  const ptr = producer.generate(updateCount);
  if (ptr === 0) {
    throw new Error(`The producer rejected a batch of ${updateCount} updates.`);
  }
  return new Uint32Array(producer.memory.buffer, ptr, producer.output_len() / 4).slice();
}
