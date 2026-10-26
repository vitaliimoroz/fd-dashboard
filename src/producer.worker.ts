/// <reference lib="webworker" />

import type {
  ProbeError,
  ProbeRequest,
  ProducerWorkerResponse
} from './producer-worker-protocol';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async ({ data }: MessageEvent<ProbeRequest>) => {
  try {
    const wasmUrl = new URL('market-producer.wasm', self.location.origin);
    const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {});
    const abiVersion = instance.exports['abi_version'];
    const probe = instance.exports['probe'];

    if (typeof abiVersion !== 'function' || typeof probe !== 'function') {
      throw new Error('The Wasm module is missing required probe exports.');
    }

    const response: ProducerWorkerResponse = {
      type: 'probe-result',
      requestId: data.requestId,
      abiVersion: abiVersion() as number,
      output: probe(data.input) as number
    };
    self.postMessage(response);
  } catch (error) {
    const response: ProbeError = {
      type: 'error',
      requestId: data.requestId,
      message: error instanceof Error ? error.message : 'Unknown Wasm initialization error.'
    };
    self.postMessage(response);
  }
};
