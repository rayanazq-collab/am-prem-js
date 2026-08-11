import 'dotenv/config'
import fs from 'node:fs'

export function digitsOnly(value = '') {
  return String(value).replace(/\D+/g, '')
}

function intEnv(name, fallback) {
  const n = Number.parseInt(String(process.env[name] ?? '').trim(), 10)
  return Number.isFinite(n) ? n : fallback
}

export function loadConfig() {
  const cfg = {
    botName: String(process.env.BOT_NAME || 'AM PREM JS').trim() || 'AM PREM JS',
    prefix: String(process.env.BOT_PREFIX || '.').trim() || '.',
    mode: String(process.env.BOT_MODE || 'public').trim().toLowerCase(),
    owner: digitsOnly(process.env.OWNER),
    pairingPhone: digitsOnly(process.env.PAIRING_PHONE),
    apiBase: String(process.env.API_BASE || 'https://api.znn.my.id').trim().replace(/\/+$/, ''),
    amToken: String(process.env.AM_TOKEN || '').trim(),
    amVersion: String(process.env.AM_API_VERSION || 'v1').trim().toLowerCase(),
    maxBulk: intEnv('MAX_BULK', 100),
    bulkZipThreshold: intEnv('BULK_ZIP_THRESHOLD', 10),
    baileysLogLevel: String(process.env.BAILEYS_LOG_LEVEL || 'silent').trim() || 'silent',
    dataDir: 'data',
    sessionDir: 'session'
  }

  if (!['public', 'self'].includes(cfg.mode)) cfg.mode = 'public'
  if (cfg.maxBulk < 1) cfg.maxBulk = 100
  if (cfg.bulkZipThreshold < 1) cfg.bulkZipThreshold = 10
  if (cfg.bulkZipThreshold > cfg.maxBulk) cfg.bulkZipThreshold = cfg.maxBulk

  if (!cfg.amToken) {
    throw new Error('AM_TOKEN belum diisi. Salin .env.example menjadi .env lalu isi token AM.')
  }

  fs.mkdirSync(cfg.dataDir, { recursive: true })
  fs.mkdirSync(cfg.sessionDir, { recursive: true })

  return cfg
}
