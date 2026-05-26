import { appendFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const LOG_FILE = process.env.PI_EMOTE_LOG

if (LOG_FILE) {
  try {
    writeFileSync(
      LOG_FILE,
      `--- Log started at ${new Date().toISOString()} ---\n`,
    )
  } catch (e) {}
}

export function log(msg: string) {
  if (!LOG_FILE) return

  try {
    appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`)
  } catch (e) {}
}
