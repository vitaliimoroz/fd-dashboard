export interface ProbeRequest {
  type: 'probe';
  requestId: number;
  /** Absolute URL of the Wasm module, resolved against the document base URI. */
  wasmUrl: string;
}

export interface ProbeResult {
  type: 'probe-result';
  requestId: number;
  abiVersion: number;
  /** Number of updates in the sample batch the worker generated. */
  updateCount: number;
}

export interface ProbeError {
  type: 'error';
  requestId: number;
  message: string;
}

export type ProducerWorkerResponse = ProbeResult | ProbeError;
