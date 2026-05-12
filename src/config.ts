import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Config, EmotesConfig } from './types'

export class PathResolver {
  readonly localEmotesDir: string
  readonly globalEmotesDir: string
  readonly defaultEmotesDir: string

  constructor(extDir: string) {
    this.localEmotesDir = join(
      process.cwd(),
      '.pi',
      'extensions',
      'pi-emote',
      'emotes',
    )
    const home = homedir()
    this.globalEmotesDir = home
      ? join(home, '.pi', 'agent', 'extensions', 'pi-emote', 'emotes')
      : ''
    this.defaultEmotesDir = join(extDir, 'emotes')
  }

  getSearchPaths(): string[] {
    return [
      this.localEmotesDir,
      this.globalEmotesDir,
      this.defaultEmotesDir,
    ].filter(Boolean)
  }

  getConfigPaths(): string[] {
    return this.getSearchPaths().map((p) => join(p, 'config.json'))
  }

  getCharacterDir(character: string): string | null {
    if (!character) return null
    for (const p of this.getSearchPaths()) {
      const charPath = join(p, character)
      if (existsSync(charPath)) return charPath
    }
    return null
  }

  getAllCharacters(): string[] {
    const chars = new Set<string>()
    for (const p of this.getSearchPaths()) {
      if (existsSync(p)) {
        try {
          const dirs = readdirSync(p, { withFileTypes: true })
            .filter((d) => d.isDirectory() && d.name !== '_unused')
            .map((d) => d.name)
          for (const d of dirs) chars.add(d)
        } catch (e) {}
      }
    }
    return Array.from(chars).sort()
  }
}

export function loadConfig(resolver: PathResolver): Config {
  const defaults: Config = {
    enabled: true,
    size: 8,
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

  for (const configPath of resolver.getConfigPaths()) {
    if (existsSync(configPath)) {
      try {
        const userConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
        return { ...defaults, ...userConfig }
      } catch (e) {}
    }
  }

  return defaults
}

export function saveConfig(resolver: PathResolver, config: Config) {
  const paths = resolver.getConfigPaths()
  let targetPath = paths[paths.length - 1] // Default to extension dir

  for (const p of paths) {
    if (existsSync(p)) {
      targetPath = p
      break
    }
  }

  try {
    writeFileSync(targetPath, JSON.stringify(config, null, 2))
  } catch (e) {}
}

export function loadEmotesConfig(
  resolver: PathResolver,
  character: string,
): EmotesConfig {
  const characterDir = resolver.getCharacterDir(character)
  if (!characterDir) return {}

  const emotesConfigPath = join(characterDir, 'emotes.json')
  if (existsSync(emotesConfigPath)) {
    try {
      return JSON.parse(readFileSync(emotesConfigPath, 'utf-8'))
    } catch (e) {}
  }
  return {}
}

export function getEffectiveCharacter(
  resolver: PathResolver,
  config: Config,
  modelName?: string,
): string {
  if (modelName && config.modelCharacters?.[modelName]) {
    const preferred = config.modelCharacters[modelName]
    if (resolver.getCharacterDir(preferred)) {
      return preferred
    }
  }
  return config.character
}
