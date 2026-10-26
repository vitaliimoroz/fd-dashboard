/// <reference lib="webworker" />

import type {
  ProbeError,
  ProbeRequest,
  ProducerWorkerResponse
} from './producer-worker-protocol';
import { loadProducerWasm } from './wasm-loader';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async ({ data }: MessageEvent<ProbeRequest>) => {
  try {
    const producer = await loadProducerWasm(data.wasmUrl);

    const response: ProducerWorkerResponse = {
      type: 'probe-result',
      requestId: data.requestId,
      abiVersion: producer.abi_version(),
      output: producer.probe(data.input)
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
