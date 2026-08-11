import fs from 'node:fs'
import path from 'node:path'

export class StateStore {
  constructor(filePath, defaultMode = 'public') {
    this.path = filePath
    this.data = {
      mode: ['public', 'self'].includes(defaultMode) ? defaultMode : 'public',
      current_temp: {}
    }
    this.load()
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.path, 'utf8'))
      if (['public', 'self'].includes(raw?.mode)) this.data.mode = raw.mode
      if (raw?.current_temp && typeof raw.current_temp === 'object') {
        this.data.current_temp = raw.current_temp
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        console.log('[STATE] File state lama tidak dapat dibaca, menggunakan default.')
      }
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.path), { recursive: true })
    const tmp = `${this.path}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 })
    fs.renameSync(tmp, this.path)
  }

  mode() {
    return this.data.mode
  }

  setMode(mode) {
    if (!['public', 'self'].includes(mode)) return
    this.data.mode = mode
    this.save()
  }

  currentTemp(userKey) {
    return String(this.data.current_temp[userKey] || '')
  }

  setCurrentTemp(userKey, email) {
    this.data.current_temp[userKey] = email
    this.save()
  }
}
