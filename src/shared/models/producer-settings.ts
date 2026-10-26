export interface ProducerSettings {
  instrumentCount: number;
  updatesPerBatch: number;
  batchIntervalMs: number;
}

export const DEFAULT_SETTINGS: ProducerSettings = {
  instrumentCount: 5,
  updatesPerBatch: 100,
  batchIntervalMs: 500
};

export const SETTINGS_LIMITS: Record<keyof ProducerSettings, { min: number; max: number }> = {
  instrumentCount: { min: 1, max: 50 },
  updatesPerBatch: { min: 1, max: 1_000 },
  batchIntervalMs: { min: 50, max: 2_000 }
};
