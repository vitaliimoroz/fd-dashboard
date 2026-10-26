# Realtime Fintech Dashboard

Angular 19 app that shows live, simulated market metrics. A Rust generator
compiled to WebAssembly runs inside a Web Worker, produces market updates
(trades plus bid/ask snapshots), and the worker aggregates them into
per-instrument metrics for the UI.

**Live demo:** https://fd-dashboard-beta.vercel.app/

- **Dashboard** — one row per instrument: last price, bid–ask spread,
  cumulative volume, VWAP and order-book imbalance, plus producer status and
  Pause/Resume.
- **Settings** — validated form (instrument count 1–50, updates per batch
  1–1,000, batch interval 50–2,000 ms). Apply starts a new run.

## Prerequisites

- Node.js 22.13.1 (see `.node-version`). Angular 19 does not support Node 24;
  use nvm/fnm to switch locally.
- Rust 1.99.1 with the `wasm32-unknown-unknown` target. Both are pinned in
  `rust-toolchain.toml`; `rustup toolchain install` installs them.
- Chrome, for the Karma/Jasmine tests.

## Run, build and test

```bash
npm ci
npm start                    # builds the Wasm, serves on http://localhost:4200/
npm run build                # production build into dist/fd-dashboard/browser
cargo test --manifest-path wasm-producer/Cargo.toml          # Rust generator tests
npm test -- --watch=false --browsers=ChromeHeadless          # Angular/worker tests
```

`npm start`, `npm run build` and `npm test` first run `npm run build:wasm`,
which compiles the Rust crate with Cargo and copies the module to
`public/market-producer.wasm`. The generated `.wasm` is not committed.

## Architecture

```
 Main thread (Angular)                         Web Worker
 ─────────────────────                         ──────────
 SettingsComponent ──apply()──┐
 DashboardComponent ◄─signals─┤ ProducerService ──start/pause/resume──► ProducerEngine
 ProducerStatusComponent      │ (one per app,  ◄──ready/snapshot/error──   │  every batch
                              │  owns worker)      (10 Hz, tagged runId)   ▼
                                                               Rust/Wasm generator
                                                               (seeded RNG, price state)
                                                                       │ 28-byte records
                                                                       ▼
                                                               MetricsAccumulator
```

1. **Wasm generator** (`wasm-producer/`, raw Cargo build, no wasm-bindgen).
   Keeps per-instrument state between calls: mid price (bounded random walk),
   spread and book quantities. Each update is one trade at the bid or the ask
   plus the current book. The JS ↔ Wasm contract (exports and record layout)
   is documented in [`wasm-producer/ABI.md`](wasm-producer/ABI.md).
2. **Worker** (`src/worker/`). `ProducerEngine` runs one batch, folds every
   record into `MetricsAccumulator`, then schedules the next batch. It posts a
   snapshot to the UI at most every 100 ms.
3. **Angular** (`src/app/`). `ProducerService` is a root singleton created at
   startup. It owns the worker and exposes signals that the pages render.

### Design decisions

- **Metrics are calculated in the worker.** Only a small snapshot (≤ 50 rows)
  crosses to the main thread, instead of up to 20,000 updates per second, so
  the UI stays responsive at the maximum rate.
- **Throttled snapshots never drop trades.** Every batch is aggregated as soon
  as it is generated; the 100 ms timer only decides how often the *current
  totals* are sent. Pausing sends the latest totals immediately. A test runs
  the real Wasm through the engine and checks every instrument's volume, VWAP
  and last price against an independent tally.
- **Cumulative totals, no history.** Per instrument the worker keeps only last
  price, volume, `sum(price × quantity)` and the latest book. Prices stay in
  integer cents and are rounded only for display.
- **Runs and stale results.** Apply terminates the worker and starts a new one
  with a higher `runId`. Every worker message carries its `runId`, and the
  service ignores any message that is not from the current run.
- **Pause/Resume.** Pause cancels the next batch; Resume runs one batch
  immediately and continues on the interval, with no catch-up for the paused
  time. A pause that arrives while the Wasm is still loading is respected.
- **Batch scheduling.** The next batch is scheduled with `setTimeout` after the
  previous one finishes, so batches never overlap. The effective rate is
  therefore slightly below nominal by the time spent generating a batch.
- **Navigation.** The producer lives in a root service, not in a page, so
  switching pages keeps the run and its running/paused state and never creates
  another worker. An unapplied settings draft is discarded on leaving the page.
- **Errors.** Fetch failures (with HTTP status), missing exports, an ABI
  version mismatch, worker script failures and generator errors all end in an
  `Error` status with a readable message.
- **Numeric precision.** `sum(priceCents × quantity)` is a JavaScript number,
  exact up to 2^53. In the worst case (one instrument, maximum rate, ~$500
  price) it stays exact for about a day; beyond that the relative error is
  ~10⁻¹⁶, far below the cent shown on screen.

## Project structure

```
src/
  shared/models/   framework-free contracts used by both threads
                   (settings, instrument metrics, worker messages)
  shared/          helpers used by both threads (error-message.ts)
  worker/          Web Worker only, no Angular: Wasm loader, run engine,
                   metrics accumulator
  app/core/        app-wide singletons (ProducerService owns the worker)
  app/features/    routed pages (dashboard, settings)
  app/shared/      reusable UI building blocks (pipes/)
  styles/          Sass partials, e.g. _tokens.scss (shared variables)
wasm-producer/     Rust generator compiled to raw Wasm (see ABI.md)
```

Path aliases `@app/*`, `@shared/*` and `@worker/*` are defined in
`tsconfig.json`; within a folder, imports stay relative. `tsconfig.worker.json`
does not define `@app/*`, so worker code cannot import Angular app code through
the alias.

## Tests

No test depends on real-time waits; timers are controlled with
`jasmine.clock()`, and the Karma suite runs in well under a second.

| Area | Tests |
|---|---|
| Metric calculations: worked example, zero denominators, instrument isolation | `worker/metrics-accumulator.spec.ts`, pipe specs, `dashboard.component.spec.ts` |
| Settings validation, draft vs active, Apply/reset | `settings-validators.spec.ts`, `settings.component.spec.ts`, `producer.service.spec.ts` |
| Pause/resume, no catch-up, stale-run rejection | `producer-engine.spec.ts`, `producer.service.spec.ts`, `producer-status.component.spec.ts` |
| Navigation keeps the run, no extra producers | `app/navigation.spec.ts` |
| Generator: batch sizes, valid values, determinism | Rust tests in `wasm-producer/src/`, `worker/wasm-loader.spec.ts` (compiled module), `worker/pipeline.spec.ts` |

## Deployment

The repository is connected to Vercel. Every push to `main` triggers a
production deployment with no manual steps: `scripts/vercel-build.sh` installs
the Rust toolchain pinned in `rust-toolchain.toml`, `npm run build` compiles the
Wasm from source and builds Angular, and `dist/fd-dashboard/browser` is served.
`vercel.json` rewrites unknown paths to `index.html`, so `/settings` works on
reload.
