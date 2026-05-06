import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Config, EmotesConfig } from './types'

const home = homedir()
const globalEmotesDir = home ? join(home, '.pi', 'agent', 'emote') : ''

export function loadConfig(extDir: string): Config {
  const defaults: Config = {
    enabled: true,
    size: 8,
    readingSpeed: 4,
    character: 'pi',
    hideBelow: 80,
    holdDuration: { hi: 2000, success: 1200, failure: 1200 },
    blinkInterval: [3000, 6000],
    talkTickMs: 120,
    cycleMs: 500,
    idle: { default: 'idle.png', blink: 'idle_blink.png' },
    talk: {
      weights: {
        'talk_close.png': 0.15,
        'talk_small.png': 0.3,
        'talk_mid.png': 0.35,
        'talk_wide.png': 0.2,
      },
    },
  }

  if (!extDir) return defaults

  const configPath = join(extDir, 'config.json')
  if (existsSync(configPath)) {
    try {
      const userConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
      return { ...defaults, ...userConfig }
    } catch (e) {
      // ignore parse errors and return defaults
    }
  }
  return defaults
}

export function saveConfig(extDir: string, config: Config) {
  if (!extDir) return
  try {
    const configPath = join(extDir, 'config.json')
    writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (e) {
    // ignore write errors
  }
}

export function getCharacterDir(
  extDir: string,
  character: string,
): string | null {
  if (!character) return null

  if (globalEmotesDir) {
    const globalPath = join(globalEmotesDir, character)
    if (existsSync(globalPath)) return globalPath
  }

  if (!extDir) return null
  const localPath = join(extDir, 'emotes', character)
  if (existsSync(localPath)) return localPath

  return null
}

export function loadEmotesConfig(
  extDir: string,
  character: string,
): EmotesConfig {
  const characterDir = getCharacterDir(extDir, character)
  if (!characterDir) return {}

  const emotesConfigPath = join(characterDir, 'emotes.json')
  if (existsSync(emotesConfigPath)) {
    return JSON.parse(readFileSync(emotesConfigPath, 'utf-8'))
  }
  return {}
}
