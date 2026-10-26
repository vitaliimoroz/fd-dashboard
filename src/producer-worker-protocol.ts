export interface ProbeRequest {
  type: 'probe';
  requestId: number;
  input: number;
}

export interface ProbeResult {
  type: 'probe-result';
  requestId: number;
  abiVersion: number;
  output: number;
}

export interface ProbeError {
  type: 'error';
  requestId: number;
  message: string;
}

export type ProducerWorkerResponse = ProbeResult | ProbeError;
