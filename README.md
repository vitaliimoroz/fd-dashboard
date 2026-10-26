# Realtime Fintech Dashboard

Angular 19 application with a Rust WebAssembly producer loaded directly in a
module Web Worker. The current scaffold verifies the raw-Wasm build and worker
integration; dashboard features are being built incrementally.

## Prerequisites

- Node.js 22.13.1 (see `.node-version`)
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

## Deployment

The `fd-dashboard` Vercel project builds the Wasm from source using
`scripts/vercel-build.sh`, then builds Angular into
`dist/fd-dashboard/browser`. Pushes to `main` are intended to trigger automatic
production deployments. The public demo is at
https://fd-dashboard-beta.vercel.app/.
