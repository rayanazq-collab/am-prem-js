import { loadConfig } from './lib/config.js'
import { Bot } from './lib/bot.js'

async function main() {
  let cfg

  try {
    cfg = loadConfig()
  } catch (error) {
    console.error('[CONFIG]', error?.message || String(error))
    process.exit(1)
  }

  console.log('==========================================')
  console.log(cfg.botName)
  console.log(`Mode   : ${cfg.mode.toUpperCase()}`)
  console.log(`Prefix : ${cfg.prefix}`)
  console.log('==========================================')

  const bot = new Bot(cfg)

  process.on('unhandledRejection', error => {
    console.log('[UNHANDLED]', error?.message || String(error))
  })

  process.on('uncaughtException', error => {
    console.log('[UNCAUGHT]', error?.message || String(error))
  })

  await bot.start()
}

main().catch(error => {
  console.error('[START]', error?.message || String(error))
  process.exit(1)
})
