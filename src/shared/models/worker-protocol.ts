import type { InstrumentMetrics } from './instrument-metrics';
import type { ProducerSettings } from './producer-settings';

// Every message carries the run it belongs to, so the main thread can drop
// anything that arrives from a replaced run.

export interface StartRequest {
  type: 'start';
  runId: number;
  /** Absolute URL of the Wasm module, resolved against the document base URI. */
  wasmUrl: string;
  settings: ProducerSettings;
  seed: bigint;
}

export interface PauseRequest {
  type: 'pause';
  runId: number;
}

export interface ResumeRequest {
  type: 'resume';
  runId: number;
}

export type ProducerWorkerRequest = StartRequest | PauseRequest | ResumeRequest;

/** The Wasm module is loaded and the run can generate data. */
export interface ReadyResponse {
  type: 'ready';
  runId: number;
}

export interface SnapshotResponse {
  type: 'snapshot';
  runId: number;
  instruments: InstrumentMetrics[];
  /** Total market updates generated in this run. */
  totalUpdates: number;
}

export interface ErrorResponse {
  type: 'error';
  runId: number;
  message: string;
}

export type ProducerWorkerResponse = ReadyResponse | SnapshotResponse | ErrorResponse;
