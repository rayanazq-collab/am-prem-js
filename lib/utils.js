const STRICT_EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
const EMBEDDED_EMAIL_RE = /[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+/g
const URL_RE = /https?:\/\/[^\s"'<>]+/gi

export function digitsOnly(value = '') {
  return String(value).replace(/\D+/g, '')
}

export function validEmail(value = '') {
  const email = String(value).trim()
  if (!email || email.length > 254 || !STRICT_EMAIL_RE.test(email)) return false
  const local = email.split('@')[0] || ''
  return Boolean(local) &&
    !local.startsWith('.') &&
    !local.endsWith('.') &&
    !local.includes('..')
}

export function validHTTPURL(value = '') {
  try {
    const u = new URL(String(value).trim())
    return (u.protocol === 'http:' || u.protocol === 'https:') && Boolean(u.hostname)
  } catch {
    return false
  }
}

export function validAlightURL(value = '') {
  if (!validHTTPURL(value)) return false
  const low = String(value).toLowerCase()
  return low.includes('alight-creative') || low.includes('firebaseapp.com')
}

export function htmlDecode(value = '') {
  return String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;/gi, '/')
    .replace(/&#47;/gi, '/')
    .replace(/&#64;/gi, '@')
    .replace(/&nbsp;/gi, ' ')
}

function getCI(obj, key) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return undefined
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key]
  const found = Object.keys(obj).find(k => k.toLowerCase() === String(key).toLowerCase())
  return found === undefined ? undefined : obj[found]
}

export function findPath(value, path) {
  let cur = value
  for (const part of String(path).split('.')) {
    cur = getCI(cur, part)
    if (cur === undefined || cur === null) return undefined
  }
  return cur
}

export function firstString(value, ...paths) {
  for (const path of paths) {
    const found = findPath(value, path)
    if (found === undefined || found === null) continue
    if (typeof found === 'string' || typeof found === 'number') {
      const out = String(found).trim()
      if (out) return out
    }
  }
  return ''
}

export function collectBulkEmails(value) {
  const out = []
  const seen = new Set()

  function pushEmail(raw) {
    const candidate = String(raw).trim().replace(/^[()[\]{}<>.,;:\\'"]+|[()[\]{}<>.,;:\\'"]+$/g, '')
    if (!validEmail(candidate)) return
    const low = candidate.toLowerCase()
    if (
      low.includes('alight-creative.firebaseapp.com') ||
      low.startsWith('noreply@') ||
      low.startsWith('reply@')
    ) return
    if (!seen.has(low)) {
      seen.add(low)
      out.push(candidate)
    }
  }

  function walk(node, depth = 0) {
    if (node === null || node === undefined || depth > 14) return

    if (typeof node === 'string') {
      const matches = htmlDecode(node).match(EMBEDDED_EMAIL_RE) || []
      for (const match of matches) pushEmail(match)
      return
    }

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }

    if (typeof node === 'object') {
      const priority = [
        'email', 'address', 'mail', 'email_address', 'emailAddress',
        'emails', 'accounts', 'account', 'result', 'data', 'results', 'items'
      ]
      const used = new Set()
      for (const key of priority) {
        const foundKey = Object.keys(node).find(k => k.toLowerCase() === key.toLowerCase())
        if (foundKey !== undefined) {
          used.add(foundKey)
          walk(node[foundKey], depth + 1)
        }
      }
      for (const key of Object.keys(node).sort()) {
        if (!used.has(key)) walk(node[key], depth + 1)
      }
      return
    }

    walk(String(node), depth + 1)
  }

  walk(value, 0)
  return out
}

export function firstBulkEmail(value) {
  return collectBulkEmails(value)[0] || ''
}

export function extractPayload(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of ['result', 'data', 'results', 'items']) {
      const found = getCI(value, key)
      if (found !== undefined && found !== null) return found
    }
  }
  return value
}

export function prettyPayload(value) {
  const payload = extractPayload(value)
  if (typeof payload === 'string') return payload.trim()
  try {
    return JSON.stringify(payload, null, 2).trim()
  } catch {
    return String(payload ?? '').trim()
  }
}

export function messageText(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return ''
  for (const key of ['message', 'error', 'detail', 'msg', 'description']) {
    const found = getCI(value, key)
    if (typeof found === 'string' && found.trim()) return found.trim()
  }
  return ''
}

export function mailMessages(value) {
  for (const path of [
    'data.messages', 'messages', 'result.messages',
    'data.inbox', 'inbox', 'result.inbox'
  ]) {
    const found = findPath(value, path)
    if (Array.isArray(found)) return found
  }
  return []
}

export function mailFingerprint(value) {
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function mailBaseline(value) {
  return new Set(mailMessages(value).map(mailFingerprint))
}

export function collectURLs(value) {
  const out = []
  const seen = new Set()

  function walk(node, depth = 0) {
    if (node === null || node === undefined || depth > 14) return
    if (typeof node === 'string') {
      const source = htmlDecode(node)
      const matches = source.match(URL_RE) || []
      for (const raw of matches) {
        const url = raw.replace(/[).,;\]}]+$/g, '')
        if (!seen.has(url)) {
          seen.add(url)
          out.push(url)
        }
      }
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1)
      return
    }
    if (typeof node === 'object') {
      for (const item of Object.values(node)) walk(item, depth + 1)
    }
  }

  walk(value, 0)
  return out
}

export function alightURLFromMail(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of ['login_url', 'loginUrl', 'verification_url', 'verificationUrl', 'url']) {
      const raw = getCI(value, key)
      if (raw !== undefined && raw !== null) {
        const candidate = htmlDecode(String(raw).trim())
        if (validAlightURL(candidate)) return candidate
      }
    }
  }

  for (const url of collectURLs(value)) {
    if (validAlightURL(url)) return url
  }
  return ''
}

export function mailReceivedTime(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 0

  for (const key of [
    'received', 'received_at', 'receivedAt', 'created_at',
    'createdAt', 'date', 'time', 'timestamp'
  ]) {
    const raw = getCI(value, key)
    if (raw === undefined || raw === null) continue

    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw > 1_000_000_000_000 ? raw : raw * 1000
    }

    if (typeof raw === 'string' && raw.trim()) {
      const numeric = Number(raw)
      if (Number.isFinite(numeric) && numeric > 0) {
        return numeric > 1_000_000_000_000 ? numeric : numeric * 1000
      }
      const parsed = Date.parse(raw)
      if (Number.isFinite(parsed)) return parsed
    }
  }

  return 0
}

export function latestFreshAlightURL(value, baseline = new Set(), startedMs = 0) {
  let best = null
  const messages = mailMessages(value)

  messages.forEach((item, index) => {
    if (baseline.has(mailFingerprint(item))) return

    const received = mailReceivedTime(item)
    if (startedMs && received && received < startedMs - 30_000) return

    const link = alightURLFromMail(item)
    if (!link) return

    const candidate = { link, received, index }
    if (
      !best ||
      (candidate.received && (!best.received || candidate.received > best.received)) ||
      (candidate.received === best.received && candidate.index < best.index)
    ) {
      best = candidate
    }
  })

  return best?.link || ''
}

export function normalizeMessageContent(message) {
  let current = message
  for (let i = 0; i < 6; i++) {
    if (!current || typeof current !== 'object') break
    if (current.ephemeralMessage?.message) {
      current = current.ephemeralMessage.message
      continue
    }
    if (current.viewOnceMessage?.message) {
      current = current.viewOnceMessage.message
      continue
    }
    if (current.viewOnceMessageV2?.message) {
      current = current.viewOnceMessageV2.message
      continue
    }
    if (current.documentWithCaptionMessage?.message) {
      current = current.documentWithCaptionMessage.message
      continue
    }
    break
  }
  return current || {}
}

export function messageBody(message) {
  const m = normalizeMessageContent(message)
  return String(
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    ''
  ).trim()
}

export function senderIdentity(msg) {
  const key = msg?.key || {}
  return String(
    key.participantAlt ||
    key.participant ||
    key.remoteJidAlt ||
    key.remoteJid ||
    ''
  )
}

export function sessionKey(msg) {
  return `${String(msg?.key?.remoteJid || '')}|${senderIdentity(msg)}`
}
