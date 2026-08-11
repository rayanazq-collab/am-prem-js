import { messageText } from './utils.js'

export class APIError extends Error {
  constructor(service, status, publicMessage) {
    super(status ? `${service} ${status}: ${publicMessage}` : `${service}: ${publicMessage}`)
    this.name = 'APIError'
    this.service = service
    this.status = status
    this.publicMessage = publicMessage
  }
}

function publicHTTPError(service, status, data) {
  let message = messageText(data)

  if (status >= 500) {
    if (status === 502) message = 'Layanan sedang bermasalah (Bad Gateway).'
    else if (status === 503) message = 'Layanan sedang tidak tersedia sementara.'
    else if (status === 504) message = 'Layanan melewati batas waktu.'
    else message = 'Layanan sedang bermasalah sementara.'
  }

  if (!message) message = 'Permintaan gagal diproses.'
  return new APIError(service, status, message)
}

async function parseJSONResponse(res, service) {
  const text = await res.text()
  let data = null
  if (text.trim()) {
    try {
      data = JSON.parse(text)
    } catch {
      if (!res.ok) throw publicHTTPError(service, res.status, {})
      throw new APIError(service, res.status, 'Respons server tidak dapat dibaca.')
    }
  }

  if (!res.ok) throw publicHTTPError(service, res.status, data || {})

  if (data && typeof data === 'object' && data.status === false) {
    throw new APIError(service, res.status, messageText(data) || 'Permintaan gagal diproses.')
  }

  return data
}

export class APIClient {
  constructor(cfg) {
    this.base = cfg.apiBase
    this.amToken = cfg.amToken
    this.amVersion = cfg.amVersion
  }

  async get(service, path, params = {}, headers = {}, timeoutMs = 90_000) {
    const url = new URL(this.base + path)
    for (const [key, value] of Object.entries(params)) {
      const text = String(value ?? '').trim()
      if (text) url.searchParams.set(key, text)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'AM-PREM-JS/1.0',
          ...headers
        },
        signal: controller.signal
      })
      return await parseJSONResponse(res, service)
    } catch (error) {
      if (error instanceof APIError) throw error
      if (error?.name === 'AbortError') {
        throw new APIError(service, 0, 'Layanan melewati batas waktu.')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  async amGet(action, params = {}, timeoutMs = 90_000) {
    const clean = String(action).replace(/^\/+|\/+$/g, '')
    let path = `/alightmotion/${clean}`
    if (this.amVersion === 'v2' && clean !== 'bulk') path += '-v2'

    return this.get(
      'API Alight Motion',
      path,
      params,
      {
        Authorization: `Bearer ${this.amToken}`,
        'X-API-Token': this.amToken
      },
      timeoutMs
    )
  }

  async tempNew(timeoutMs = 45_000) {
    return this.get('API Temp Mail', '/tempmail', {}, {}, timeoutMs)
  }

  async tempRead(email, timeoutMs = 45_000) {
    return this.get('API Temp Mail', '/tempmail-read', { email }, {}, timeoutMs)
  }
}
