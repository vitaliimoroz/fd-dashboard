import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { delimiter, join, resolve } from 'node:path';

const cargoBin = join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.cargo', 'bin');
const env = {
  ...process.env,
  PATH: [cargoBin, process.env.PATH].filter(Boolean).join(delimiter)
};
const cargo = process.platform === 'win32' ? 'cargo.exe' : 'cargo';
const result = spawnSync(
  cargo,
  [
    'build',
    '--manifest-path',
    resolve('wasm-producer/Cargo.toml'),
    '--target',
    'wasm32-unknown-unknown',
    '--release'
  ],
  { env, stdio: 'inherit' }
);

if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const wasmPath = resolve('wasm-producer/target/wasm32-unknown-unknown/release/market_producer.wasm');
mkdirSync(resolve('public'), { recursive: true });
copyFileSync(wasmPath, resolve('public/market-producer.wasm'));
