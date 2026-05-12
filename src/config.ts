import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Config, EmotesConfig } from './types'

const home = homedir()
export const localEmotesDir = join(
  process.cwd(),
  '.pi',
  'extensions',
  'pi-emote',
  'emotes',
)
export const globalEmotesDir = home
  ? join(home, '.pi', 'agent', 'extensions', 'pi-emote', 'emotes')
  : ''

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

  const configPaths = [
    join(localEmotesDir, 'config.json'),
    ...(globalEmotesDir ? [join(globalEmotesDir, 'config.json')] : []),
    ...(extDir ? [join(extDir, 'config.json')] : []),
  ]

  for (const configPath of configPaths) {
    if (existsSync(configPath)) {
      try {
        const userConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
        return { ...defaults, ...userConfig }
      } catch (e) {
        // ignore parse errors and try next
      }
    }
  }

  return defaults
}

export function saveConfig(extDir: string, config: Config) {
  const possiblePaths = [
    join(localEmotesDir, 'config.json'),
    ...(globalEmotesDir ? [join(globalEmotesDir, 'config.json')] : []),
    join(extDir, 'config.json'),
  ]

  let targetPath = join(extDir, 'config.json')

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      targetPath = p
      break
    }
  }

  if (!existsSync(targetPath) && existsSync(localEmotesDir)) {
    targetPath = join(localEmotesDir, 'config.json')
  }

  try {
    writeFileSync(targetPath, JSON.stringify(config, null, 2))
  } catch (e) {
    // ignore write errors
  }
}

export function getCharacterDir(
  extDir: string,
  character: string,
): string | null {
  if (!character) return null

  // 1. Local (.pi/emote)
  const localPath = join(localEmotesDir, character)
  if (existsSync(localPath)) return localPath

  // 2. Global (~/.pi/agent/emote)
  if (globalEmotesDir) {
    const globalPath = join(globalEmotesDir, character)
    if (existsSync(globalPath)) return globalPath
  }

  // 3. Extension Default
  if (extDir) {
    const extPath = join(extDir, 'emotes', character)
    if (existsSync(extPath)) return extPath
  }

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

export function getEffectiveCharacter(
  extDir: string,
  config: Config,
  modelName?: string,
): string {
  if (modelName && config.modelCharacters?.[modelName]) {
    const preferred = config.modelCharacters[modelName]
    // Verify the character exists
    if (getCharacterDir(extDir, preferred)) {
      return preferred
    }
  }
  return config.character
}
