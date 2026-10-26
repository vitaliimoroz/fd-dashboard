import {
  EXPECTED_ABI_VERSION,
  Field,
  ProducerExports,
  RECORD_FIELDS,
  generateBatch,
  initProducer,
  loadProducerWasm
} from './wasm-loader';

describe('loadProducerWasm', () => {
  const wasmUrl = new URL('market-producer.wasm', document.baseURI).href;

  it('instantiates the built producer module', async () => {
    const producer = await loadProducerWasm(wasmUrl);

    expect(producer.abi_version()).toBe(EXPECTED_ABI_VERSION);
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

  const respondWith = (bytes: BufferSource) => () =>
    Promise.resolve(new Response(bytes, { headers: { 'Content-Type': 'application/octet-stream' } }));

  it('rejects a valid module that lacks the producer exports', async () => {
    const emptyModule = new Uint8Array([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

    await expectAsync(
      loadProducerWasm(wasmUrl, respondWith(emptyModule) as typeof fetch)
    ).toBeRejectedWithError(/missing required exports/);
  });

  it('rejects a module built for a different ABI version', async () => {
    const exports = {
      memory: new WebAssembly.Memory({ initial: 1 }),
      abi_version: () => EXPECTED_ABI_VERSION + 1,
      init: () => 1,
      generate: () => 0,
      output_len: () => 0
    };
    // instantiate() is overloaded, so spyOn cannot infer which result type to expect.
    (spyOn(WebAssembly, 'instantiate') as jasmine.Spy).and.resolveTo({ instance: { exports } });

    await expectAsync(
      loadProducerWasm(wasmUrl, respondWith(new ArrayBuffer(0)) as typeof fetch)
    ).toBeRejectedWithError(`Unsupported Wasm ABI version ${EXPECTED_ABI_VERSION + 1}; expected ${EXPECTED_ABI_VERSION}.`);
  });
});

describe('compiled Wasm generator', () => {
  const wasmUrl = new URL('market-producer.wasm', document.baseURI).href;
  let producer: ProducerExports;

  beforeEach(async () => {
    producer = await loadProducerWasm(wasmUrl);
  });

  it('returns exactly the requested number of records', () => {
    initProducer(producer, 1n, 5);

    for (const count of [1, 100, 1000]) {
      expect(generateBatch(producer, count).length).toBe(count * RECORD_FIELDS);
    }
  });

  it('produces valid market updates across the ABI boundary', () => {
    const instrumentCount = 50;
    initProducer(producer, 0x1234_5678_9abc_def0n, instrumentCount);

    for (let batch = 0; batch < 20; batch++) {
      const records = generateBatch(producer, 1000);
      for (let i = 0; i < records.length; i += RECORD_FIELDS) {
        const bid = records[i + Field.BidCents];
        const ask = records[i + Field.AskCents];
        const price = records[i + Field.PriceCents];
        expect(records[i + Field.Instrument]).toBeLessThan(instrumentCount);
        expect(bid).toBeGreaterThan(0);
        expect(bid).toBeLessThan(ask);
        expect(price === bid || price === ask).toBeTrue();
        expect(records[i + Field.TradeQuantity]).toBeGreaterThan(0);
      }
    }
  });

  it('is deterministic for a fixed seed', async () => {
    const other = await loadProducerWasm(wasmUrl);
    initProducer(producer, 99n, 10);
    initProducer(other, 99n, 10);

    expect(generateBatch(producer, 500)).toEqual(generateBatch(other, 500));
  });

  it('returns a copy that the next batch does not overwrite', () => {
    initProducer(producer, 3n, 5);
    const first = generateBatch(producer, 100);
    const snapshot = first.slice();

    generateBatch(producer, 100);

    expect(first).toEqual(snapshot);
  });

  it('rejects invalid instrument counts and batch sizes', () => {
    expect(() => initProducer(producer, 1n, 0)).toThrowError(/instrument count/);
    expect(() => initProducer(producer, 1n, 51)).toThrowError(/instrument count/);

    initProducer(producer, 1n, 5);
    expect(() => generateBatch(producer, 0)).toThrowError(/rejected/);
    expect(() => generateBatch(producer, 1001)).toThrowError(/rejected/);
  });
});
