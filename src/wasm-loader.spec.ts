import { EXPECTED_ABI_VERSION, loadProducerWasm } from './wasm-loader';

describe('loadProducerWasm', () => {
  const wasmUrl = new URL('market-producer.wasm', document.baseURI).href;

  it('instantiates the built producer module and calls into it', async () => {
    const producer = await loadProducerWasm(wasmUrl);

    expect(producer.abi_version()).toBe(EXPECTED_ABI_VERSION);
    expect(producer.probe(1) >>> 0).toBe(0x5741_53cd);
  });

  it('falls back to buffered instantiation when the MIME type is not application/wasm', async () => {
    const bytes = await (await fetch(wasmUrl)).arrayBuffer();
    const fakeFetch = () =>
      Promise.resolve(
        new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } })
      );

    const producer = await loadProducerWasm(wasmUrl, fakeFetch as typeof fetch);

    expect(producer.abi_version()).toBe(EXPECTED_ABI_VERSION);
  });

  it('reports the HTTP status when the module cannot be fetched', async () => {
    const fakeFetch = () => Promise.resolve(new Response(null, { status: 404 }));

    await expectAsync(loadProducerWasm(wasmUrl, fakeFetch as typeof fetch)).toBeRejectedWithError(
      /HTTP 404/
    );
  });
});
