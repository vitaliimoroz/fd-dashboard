/// <reference lib="webworker" />

import type {
  ProbeError,
  ProbeRequest,
  ProducerWorkerResponse
} from './producer-worker-protocol';
import { RECORD_FIELDS, generateBatch, initProducer, loadProducerWasm } from './wasm-loader';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async ({ data }: MessageEvent<ProbeRequest>) => {
  try {
    const producer = await loadProducerWasm(data.wasmUrl);
    initProducer(producer, 1n, 5);
    const records = generateBatch(producer, 100);

    const response: ProducerWorkerResponse = {
      type: 'probe-result',
      requestId: data.requestId,
      abiVersion: producer.abi_version(),
      updateCount: records.length / RECORD_FIELDS
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
