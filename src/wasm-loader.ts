export const EXPECTED_ABI_VERSION = 1;

export interface ProducerExports {
  memory: WebAssembly.Memory;
  abi_version(): number;
  probe(input: number): number;
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
    typeof exports.probe !== 'function'
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
