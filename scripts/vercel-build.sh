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

# Installs the toolchain, profile and targets pinned in rust-toolchain.toml.
rustup toolchain install
npm run build
