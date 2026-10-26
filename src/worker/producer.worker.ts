/// <reference lib="webworker" />

import type { ProducerWorkerRequest } from '@shared/models/worker-protocol';
import { ProducerEngine } from './producer-engine';
import { generateBatch, initProducer, loadProducerWasm } from './wasm-loader';

declare const self: DedicatedWorkerGlobalScope;

const engine = new ProducerEngine({
  async createSource({ wasmUrl, seed, settings }) {
    const producer = await loadProducerWasm(wasmUrl);
    initProducer(producer, seed, settings.instrumentCount);
    return { generate: (count) => generateBatch(producer, count) };
  },
  post: (message) => self.postMessage(message)
});

self.onmessage = ({ data }: MessageEvent<ProducerWorkerRequest>) => {
  void engine.handle(data);
};
