import { APIError } from './api.js'
import { bulkZip } from './archive.js'
import {
  digitsOnly,
  validEmail,
  validAlightURL,
  firstBulkEmail,
  firstString,
  prettyPayload,
  mailMessages,
  mailBaseline,
  latestFreshAlightURL,
  senderIdentity,
  sessionKey
} from './utils.js'

export class CommandService {
  constructor(bot) {
    this.bot = bot
    this.verifySessions = new Map()
    this.createSessions = new Map()
  }

  isOwner(msg) {
    if (msg?.key?.fromMe) return true
    const owner = this.bot.cfg.owner
    if (!owner) return false

    const candidates = [
      senderIdentity(msg),
      msg?.key?.participant,
      msg?.key?.participantAlt,
      msg?.key?.remoteJid,
      msg?.key?.remoteJidAlt
    ]

    return candidates.some(value => digitsOnly(value) === owner)
  }

  allowed(msg) {
    return this.bot.state.mode() === 'public' || this.isOwner(msg)
  }

  async reply(msg, text) {
    await this.bot.reply(msg, text)
  }

  async handleMessage(msg, rawText) {
    const text = String(rawText || '').trim()
    if (!text) return

    if (this.allowed(msg) && await this.handleVerifyReply(msg, text)) return

    const prefix = this.bot.cfg.prefix
    if (!text.startsWith(prefix)) return

    const body = text.slice(prefix.length).trim()
    if (!body) return

    const parts = body.split(/\s+/)
    const command = String(parts.shift() || '').toLowerCase()
    const args = parts

    if (command !== 'mode' && !this.allowed(msg)) return

    if (['menu', 'help'].includes(command)) {
      await this.reply(msg, this.menu())
      return
    }

    if (['amprem', 'am', 'alightmotion'].includes(command)) {
      await this.handleAmprem(msg, args)
      return
    }

    if (['ampremcreate', 'amcreate'].includes(command)) {
      await this.handleAmpremCreate(msg, args)
      return
    }

    if (['tempmail', 'temp'].includes(command)) {
      await this.handleTempMail(msg, args)
      return
    }

    if (command === 'mode') {
      await this.handleMode(msg, args)
    }
  }

  menu() {
    const p = this.bot.cfg.prefix
    return `*${this.bot.cfg.botName}*\n\n` +
      `${p}amprem bulk <jumlah>\n` +
      `${p}amprem send <email>\n` +
      `${p}amprem verify <email>\n` +
      `${p}amprem verify <email> <link>\n` +
      `${p}ampremcreate\n` +
      `${p}tempmail\n` +
      `${p}tempmail read [email]\n` +
      `${p}mode public|self\n\n` +
      `Mode: *${this.bot.state.mode().toUpperCase()}*`
  }

  async handleMode(msg, args) {
    if (!this.isOwner(msg)) {
      await this.reply(msg, 'Command mode hanya untuk owner.')
      return
    }

    if (!args.length) {
      await this.reply(
        msg,
        `Mode saat ini: *${this.bot.state.mode().toUpperCase()}*\n\nContoh: ${this.bot.cfg.prefix}mode public`
      )
      return
    }

    const mode = String(args[0]).toLowerCase()
    if (!['public', 'self'].includes(mode)) {
      await this.reply(msg, `Pilih mode public atau self.\nContoh: ${this.bot.cfg.prefix}mode self`)
      return
    }

    this.bot.state.setMode(mode)
    await this.reply(msg, `Mode bot: *${mode.toUpperCase()}*`)
  }

  async handleAmprem(msg, args) {
    const p = this.bot.cfg.prefix

    if (!args.length) {
      await this.reply(
        msg,
        `Pilih fitur amprem:\n${p}amprem bulk 5\n${p}amprem send email@gmail.com\n${p}amprem verify email@gmail.com`
      )
      return
    }

    const action = String(args[0]).toLowerCase()

    if (action === 'bulk') {
      if (args.length < 2) {
        await this.reply(msg, `Masukkan jumlah.\nContoh: ${p}amprem bulk 5`)
        return
      }

      if (!/^\d+$/.test(String(args[1]))) {
        await this.reply(msg, `Jumlah bulk harus berupa angka.\nContoh: ${p}amprem bulk 5`)
        return
      }

      const amount = Number(args[1])
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > this.bot.cfg.maxBulk) {
        await this.reply(
          msg,
          `Jumlah bulk harus 1 sampai ${this.bot.cfg.maxBulk}.\nContoh: ${p}amprem bulk 5`
        )
        return
      }

      await this.runBulk(msg, amount)
      return
    }

    if (action === 'send') {
      if (args.length < 2) {
        await this.reply(msg, `Masukkan email.\nContoh: ${p}amprem send email@gmail.com`)
        return
      }

      const email = String(args[1]).trim().toLowerCase()
      if (!validEmail(email)) {
        await this.reply(msg, `Email tidak valid.\nContoh: ${p}amprem send email@gmail.com`)
        return
      }

      await this.runSend(msg, email)
      return
    }

    if (action === 'verify') {
      if (args.length < 2) {
        await this.reply(msg, `Masukkan email.\nContoh: ${p}amprem verify email@gmail.com`)
        return
      }

      const email = String(args[1]).trim().toLowerCase()
      if (!validEmail(email)) {
        await this.reply(msg, `Email tidak valid.\nContoh: ${p}amprem verify email@gmail.com`)
        return
      }

      if (args.length >= 3) {
        const link = args.slice(2).join(' ').trim()
        if (!validAlightURL(link)) {
          await this.reply(msg, 'Link verifikasi tidak valid. Gunakan full link Alight Creative dari email.')
          return
        }
        await this.runVerify(msg, email, link, false)
        return
      }

      await this.startVerifySession(msg, email)
      return
    }

    await this.reply(
      msg,
      `Fitur amprem tidak dikenal.\n\n${p}amprem bulk 5\n${p}amprem send email@gmail.com\n${p}amprem verify email@gmail.com`
    )
  }

  async runBulk(msg, amount) {
    try {
      const result = await this.bot.api.amGet('bulk', { amount }, 90_000)
      const text = prettyPayload(result)

      if (!text) {
        await this.reply(msg, 'Hasil bulk tidak dapat dibaca.')
        return
      }

      if (amount > this.bot.cfg.bulkZipThreshold) {
        const { data, zipName } = await bulkZip(text)
        await this.bot.sendDocument(
          msg,
          data,
          'application/zip',
          zipName,
          `AM Prem Bulk ${amount}`
        )
        return
      }

      const safeText = text.length > 50_000 ? `${text.slice(0, 50_000)}\n\n…hasil dipotong.` : text
      await this.reply(msg, `*AM PREM BULK*\n\n${safeText}`)
    } catch (error) {
      await this.replyAPIError(msg, error)
    }
  }

  async runSend(msg, email) {
    try {
      await this.bot.api.amGet('send', { email }, 60_000)
      await this.reply(msg, `Email verifikasi berhasil dikirim ke ${email}.`)
    } catch (error) {
      await this.replyAPIError(msg, error)
    }
  }

  async startVerifySession(msg, email) {
    try {
      await this.bot.api.amGet('send', { email }, 60_000)

      this.verifySessions.set(sessionKey(msg), {
        email,
        expiresAt: Date.now() + (10 * 60 * 1000)
      })

      await this.reply(
        msg,
        `Email verifikasi sudah dikirim ke ${email}.\n\n` +
        '1. Cek folder Spam.\n' +
        '2. Buka email dari noreply, lalu tekan "Laporkan bukan spam".\n' +
        '3. Buka emailnya lagi dari menu Utama.\n' +
        '4. Tekan lama "Login ke Alight Creative", lalu salin full link.\n' +
        '5. Kirim/reply full link tadi ke bot.\n\n' +
        'Link biasanya berlaku sekitar 3-5 menit.\n' +
        'Waktu sesi bot: 10 menit.'
      )
    } catch (error) {
      await this.replyAPIError(msg, error)
    }
  }

  async handleVerifyReply(msg, text) {
    const key = sessionKey(msg)
    const session = this.verifySessions.get(key)

    if (!session) return false

    if (Date.now() >= session.expiresAt) {
      this.verifySessions.delete(key)
      return false
    }

    if (!/^https?:\/\//i.test(text)) return false

    if (!validAlightURL(text)) {
      await this.reply(msg, 'Link bukan link login Alight Creative. Kirim full link dari email.')
      return true
    }

    await this.runVerify(msg, session.email, text.trim(), true)
    return true
  }

  async runVerify(msg, email, link, fromSession) {
    try {
      const result = await this.bot.api.amGet('verify', { email, link }, 60_000)

      if (fromSession) this.verifySessions.delete(sessionKey(msg))

      const text = prettyPayload(result) || 'Verifikasi berhasil.'
      await this.reply(msg, `*AM PREM VERIFY*\n\n${text}`)
    } catch (error) {
      await this.replyAPIError(msg, error)
    }
  }

  async handleTempMail(msg, args) {
    const p = this.bot.cfg.prefix
    const first = String(args[0] || '').toLowerCase()

    if (!args.length || ['new', 'create', 'buat'].includes(first)) {
      await this.createTemp(msg)
      return
    }

    if (['read', 'cek', 'inbox'].includes(first)) {
      const email = String(args[1] || this.bot.state.currentTemp(senderIdentity(msg))).trim()

      if (!email) {
        await this.reply(msg, `Belum ada email temp aktif.\nBuat dulu: ${p}tempmail`)
        return
      }

      if (!validEmail(email)) {
        await this.reply(msg, `Email tidak valid.\nContoh: ${p}tempmail read email@domain.com`)
        return
      }

      await this.readTemp(msg, email)
      return
    }

    if (validEmail(args[0])) {
      await this.readTemp(msg, args[0])
      return
    }

    await this.reply(msg, `Gunakan:\n${p}tempmail\n${p}tempmail read [email]`)
  }

  async createTemp(msg) {
    try {
      const result = await this.bot.api.tempNew()
      let email = firstString(result, 'data.email', 'email', 'result.email')
      if (!validEmail(email)) email = firstBulkEmail(result)

      if (!validEmail(email)) {
        await this.reply(msg, 'Email temp tidak ditemukan dari respons server.')
        return
      }

      this.bot.state.setCurrentTemp(senderIdentity(msg), email)
      await this.reply(
        msg,
        `*TEMP MAIL*\n\nEmail aktif:\n\`${email}\`\n\nCek inbox:\n${this.bot.cfg.prefix}tempmail read`
      )
    } catch (error) {
      await this.replyAPIError(msg, error)
    }
  }

  async readTemp(msg, email) {
    try {
      const result = await this.bot.api.tempRead(email)
      const messages = mailMessages(result)

      if (!messages.length) {
        await this.reply(msg, `*TEMP MAIL*\n\nEmail: \`${email}\`\nInbox masih kosong.`)
        return
      }

      let text = prettyPayload(result)
      if (text.length > 50_000) text = `${text.slice(0, 50_000)}\n\n…pesan dipotong.`

      await this.reply(msg, `*TEMP MAIL INBOX*\n\nEmail: \`${email}\`\n\n${text}`)
    } catch (error) {
      await this.replyAPIError(msg, error)
    }
  }

  async handleAmpremCreate(msg, args) {
    if (args.length) {
      await this.reply(msg, `Gunakan ${this.bot.cfg.prefix}ampremcreate tanpa input.`)
      return
    }

    const key = sessionKey(msg)
    const current = this.createSessions.get(key)

    if (current && Date.now() < current.expiresAt) {
      await this.reply(msg, 'Sesi ampremcreate masih berjalan. Selesaikan login atau tunggu sesi berakhir.')
      return
    }

    this.createSessions.delete(key)

    let bulk
    try {
      bulk = await this.bot.api.amGet('bulk', { amount: 1 }, 60_000)
    } catch (error) {
      await this.replyAPIError(msg, error)
      return
    }

    const email = firstBulkEmail(bulk)
    if (!validEmail(email)) {
      console.log('[AMPREMCREATE] Email tidak ditemukan dari response bulk.')
      await this.reply(msg, 'Email ampremcreate tidak ditemukan dari hasil bulk.')
      return
    }

    let baseline = new Set()
    try {
      const inbox = await this.bot.api.tempRead(email, 12_000)
      baseline = mailBaseline(inbox)
    } catch {
      // Baseline boleh kosong. Error tempmail sementara tidak perlu memenuhi console.
    }

    const session = {
      email,
      startedAt: Date.now(),
      expiresAt: Date.now() + (5 * 60 * 1000),
      baseline,
      cancelled: false
    }

    this.createSessions.set(key, session)

    await this.reply(
      msg,
      `Email login:\n\`${email}\`\n\nLogin ke Alight Motion dengan email ini. Bot akan mengecek email login otomatis selama 5 menit.`
    )

    this.pollAmpremCreate(key, session, msg).catch(() => {})
  }

  async pollAmpremCreate(key, session, msg) {
    try {
      while (!session.cancelled && Date.now() < session.expiresAt) {
        await new Promise(resolve => setTimeout(resolve, 4_000))

        let inbox
        try {
          inbox = await this.bot.api.tempRead(session.email, 12_000)
        } catch {
          // Polling sengaja diam agar console tidak penuh error sementara.
          continue
        }

        const link = latestFreshAlightURL(inbox, session.baseline, session.startedAt)
        if (link) {
          await this.reply(msg, link)
          return
        }
      }

      if (!session.cancelled) {
        await this.reply(
          msg,
          `Sesi ampremcreate berakhir. Jalankan ${this.bot.cfg.prefix}ampremcreate lagi.`
        )
      }
    } finally {
      if (this.createSessions.get(key) === session) {
        this.createSessions.delete(key)
      }
    }
  }

  async replyAPIError(msg, error) {
    if (error instanceof APIError) {
      await this.reply(msg, error.publicMessage)
      return
    }

    console.log('[API ERROR]', error?.message || String(error))
    await this.reply(msg, 'Maaf, terjadi kesalahan.')
  }
}
