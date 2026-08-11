#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "[1/5] Runtime"
node --version
npm --version

echo "[2/5] Syntax"
while IFS= read -r -d '' file; do
  node --check "$file"
done < <(find . -type f -name '*.js' \
  -not -path './node_modules/*' \
  -not -path './session/*' \
  -not -path './data/*' -print0)

echo "[3/5] Static guard"
node --input-type=module <<'NODE'
import fs from 'node:fs'

const commands = fs.readFileSync('lib/commands.js', 'utf8')
const api = fs.readFileSync('lib/api.js', 'utf8')
const env = fs.readFileSync('.env.example', 'utf8')

const required = [
  '.amprem bulk',
  '.amprem send',
  '.amprem verify',
  '.ampremcreate',
  '.tempmail read',
  '.mode public'
]

for (const item of required) {
  const needle = item.replace(/^\./, '')
  if (!commands.includes(needle)) {
    throw new Error(`Guard gagal: ${item}`)
  }
}

if (commands.includes('amprem inbox')) {
  throw new Error('Guard gagal: amprem inbox tidak boleh ada.')
}

if (!commands.includes('Masukkan email.')) {
  throw new Error('Guard gagal: validasi input amprem send/verify hilang.')
}

if (!commands.includes('Masukkan jumlah.')) {
  throw new Error('Guard gagal: validasi bulk kosong hilang.')
}

if (!commands.includes('amount: 1')) {
  throw new Error('Guard gagal: ampremcreate harus mengambil bulk 1.')
}

if (!commands.includes('5 * 60 * 1000')) {
  throw new Error('Guard gagal: session ampremcreate harus 5 menit.')
}

if (!commands.includes('10 * 60 * 1000')) {
  throw new Error('Guard gagal: session verify harus 10 menit.')
}

if (!api.includes('Authorization: `Bearer ${this.amToken}`')) {
  throw new Error('Guard gagal: token AM backend hilang.')
}

if (!env.includes('AM_TOKEN=')) {
  throw new Error('Guard gagal: AM_TOKEN tidak ada di env example.')
}

console.log('Static guard OK.')
NODE

echo "[4/5] Test"
node --test test/*.test.js

echo "[5/5] Dependency import"
node --input-type=module <<'NODE'
await import('baileys')
await import('dotenv')
await import('jszip')
await import('pino')
await import('qrcode-terminal')
console.log('Dependency import OK.')
NODE

echo "[5/5] OK"
