#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
  echo "[ERROR] File .env belum ada."
  echo "Salin .env.example menjadi .env lalu isi AM_TOKEN dan konfigurasi bot."
  exit 1
fi

if [ ! -d "node_modules" ]; then
  echo "[INFO] node_modules belum ada, menjalankan npm install..."
  npm install
fi

exec npm start
