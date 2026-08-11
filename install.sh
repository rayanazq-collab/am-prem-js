#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[1/4] Node"
node --version
npm --version

echo "[2/4] Folder"
mkdir -p session data

echo "[3/4] Dependency"
npm install

echo "[4/4] Check"
bash check.sh

echo "Install selesai."
