#!/usr/bin/env bash
set -euo pipefail

if ! command -v rustup >/dev/null 2>&1 || ! command -v cargo >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none
fi

if [[ -f "$HOME/.cargo/env" ]]; then
  source "$HOME/.cargo/env"
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "Cargo is not available after Rust installation." >&2
  exit 1
fi

rustup toolchain install 1.99.1 --profile minimal --target wasm32-unknown-unknown
npm run build
