# Realtime Fintech Dashboard

Angular 19 application with a Rust WebAssembly producer loaded directly in a
module Web Worker. The current scaffold verifies the raw-Wasm build and worker
integration; dashboard features are being built incrementally.

## Prerequisites

- Node.js 22.13.1 (see `.node-version`). Angular 19 does not support Node 24;
  use nvm/fnm to switch locally.
- Rust 1.99.1 (selected by `rust-toolchain.toml`; the Wasm target is installed
  by rustup)
- Chrome for the Angular Karma/Jasmine browser tests

## Run locally

```bash
npm ci
npm start
```

`npm start` builds the Wasm module into `public/market-producer.wasm` before
starting Angular on `http://localhost:4200/`.

## Build and test

```bash
npm run build
cargo test --manifest-path wasm-producer/Cargo.toml
npm run build:wasm
npx ng test --watch=false --browsers=ChromeHeadless
```

The generated `.wasm` file and Rust build output are not committed. The
`scripts/build-wasm.mjs` script compiles the pinned Rust source for
`wasm32-unknown-unknown` and copies the artifact into `public/`.

## Project structure

```
src/
  shared/models/   framework-free contracts used by both threads
                   (settings, instrument metrics, worker messages)
  worker/          Web Worker only, no Angular: Wasm loader, run engine,
                   metrics accumulator
  app/core/        app-wide singletons (ProducerService owns the worker)
  app/features/    routed pages (dashboard, settings)
  app/shared/      reusable UI building blocks (pipes/, components/)
  styles/          Sass partials, e.g. _tokens.scss (shared variables)
wasm-producer/     Rust generator compiled to raw Wasm (see ABI.md)
```

Path aliases `@app/*`, `@shared/*` and `@worker/*` are defined in
`tsconfig.json`. Within a folder, imports stay relative.

## Deployment

The `fd-dashboard` Vercel project builds the Wasm from source using
`scripts/vercel-build.sh`, then builds Angular into
`dist/fd-dashboard/browser`. Every push to `main` triggers an automatic
production deployment. The Rust version comes only from `rust-toolchain.toml`. The public demo is at
https://fd-dashboard-beta.vercel.app/.
