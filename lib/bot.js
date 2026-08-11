import fs from 'node:fs'
import path from 'node:path'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import makeWASocket, {
  Browsers,
  DisconnectReason,
  delay,
  useMultiFileAuthState
} from 'baileys'

import { APIClient } from './api.js'
import { StateStore } from './state.js'
import { CommandService } from './commands.js'
import { messageBody } from './utils.js'

export class Bot {
  constructor(cfg) {
    this.cfg = cfg
    this.api = new APIClient(cfg)
    this.state = new StateStore(path.join(cfg.dataDir, 'state.json'), cfg.mode)
    this.commands = new CommandService(this)
    this.sock = null
    this.connecting = false
    this.reconnectTimer = null
    this.pairingRequested = false
    this.processed = new Set()
  }

  rememberMessage(id) {
    if (!id) return true
    if (this.processed.has(id)) return false
    this.processed.add(id)

    if (this.processed.size > 2000) {
      const first = this.processed.values().next().value
      if (first) this.processed.delete(first)
    }
    return true
  }

  async start() {
    await this.connect()
  }

  async connect() {
    if (this.connecting) return
    this.connecting = true

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.cfg.sessionDir)

      const sock = makeWASocket({
        auth: state,
        logger: pino({ level: this.cfg.baileysLogLevel }),
        browser: Browsers.ubuntu('Chrome'),
        printQRInTerminal: false,
        emitOwnEvents: true,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        generateHighQualityLinkPreview: false
      })

      this.sock = sock
      this.pairingRequested = false

      sock.ev.on('creds.update', saveCreds)

      sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages || []) {
          try {
            if (!msg?.message || msg?.key?.remoteJid === 'status@broadcast') continue
            if (!this.rememberMessage(msg?.key?.id)) continue

            const text = messageBody(msg.message)
            if (!text) continue

            await this.commands.handleMessage(msg, text)
          } catch (error) {
            console.log('[MESSAGE ERROR]', error?.message || String(error))
          }
        }
      })

      sock.ev.on('connection.update', async update => {
        const { connection, lastDisconnect, qr } = update

        if (qr && !state.creds.registered && !this.cfg.pairingPhone) {
          console.log('\n[WA] Scan QR berikut dari WhatsApp > Perangkat tertaut:\n')
          qrcode.generate(qr, { small: true })
        }

        if (connection === 'open') {
          this.connecting = false
          this.pairingRequested = false
          console.log('[WA] Bot terhubung.')
          return
        }

        if (connection === 'close') {
          this.connecting = false

          const statusCode =
            lastDisconnect?.error?.output?.statusCode ||
            lastDisconnect?.error?.data?.statusCode ||
            0

          if (statusCode === DisconnectReason.loggedOut) {
            console.log('[WA] Session logout. Hapus folder session lalu pairing ulang.')
            return
          }

          console.log(`[WA] Koneksi terputus${statusCode ? ` (${statusCode})` : ''}. Mencoba reconnect...`)
          clearTimeout(this.reconnectTimer)
          this.reconnectTimer = setTimeout(() => {
            this.connect().catch(error => {
              console.log('[WA] Reconnect gagal:', error?.message || String(error))
            })
          }, 3000)
        }
      })

      if (!state.creds.registered && this.cfg.pairingPhone) {
        this.requestPairingCode(sock).catch(error => {
          console.log('[WA] Pairing code gagal:', error?.message || String(error))
          console.log('[WA] Jika terus gagal, kosongkan PAIRING_PHONE untuk memakai QR.')
        })
      }

      this.connecting = false
    } catch (error) {
      this.connecting = false
      throw error
    }
  }

  async requestPairingCode(sock) {
    if (this.pairingRequested) return
    this.pairingRequested = true

    const phone = this.cfg.pairingPhone
    if (!phone) return

    let lastError = null

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await delay(attempt === 1 ? 2500 : 5000)
        const code = await sock.requestPairingCode(phone)
        const formatted = String(code || '').match(/.{1,4}/g)?.join('-') || String(code || '')

        console.log('================================================')
        console.log('PAIRING CODE:', formatted)
        console.log('WhatsApp > Perangkat tertaut > Tautkan dengan nomor telepon')
        console.log('================================================')
        return
      } catch (error) {
        lastError = error
      }
    }

    throw lastError || new Error('Pairing code tidak dapat dibuat.')
  }

  async reply(msg, text) {
    if (!this.sock) throw new Error('Socket WhatsApp belum tersedia.')
    const chat = msg?.key?.remoteJid
    if (!chat) throw new Error('Chat tidak ditemukan.')
    await this.sock.sendMessage(chat, { text: String(text) }, { quoted: msg })
  }

  async sendDocument(msg, buffer, mimetype, fileName, caption = '') {
    if (!this.sock) throw new Error('Socket WhatsApp belum tersedia.')
    const chat = msg?.key?.remoteJid
    if (!chat) throw new Error('Chat tidak ditemukan.')

    await this.sock.sendMessage(
      chat,
      {
        document: buffer,
        mimetype,
        fileName,
        caption
      },
      { quoted: msg }
    )
  }
}
