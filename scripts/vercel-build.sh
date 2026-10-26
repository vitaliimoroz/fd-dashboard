#!/usr/bin/env bash
set -euo pipefail

if ! command -v rustup >/dev/null 2>&1; then
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain none
fi

source "$HOME/.cargo/env"
rustup toolchain install 1.99.1 --profile minimal --target wasm32-unknown-unknown
npm run build
