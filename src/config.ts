import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Config, EmoteMapping, EmotesConfig } from './types'
import { log } from './log'

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
    hideBelow: 40,
    terminals: [
      { match: 'zellij', render: 'ascii' },
      { match: 'tmux', render: 'auto' },
      { match: 'screen', render: 'ascii' },
      { match: 'wezterm', render: 'iterm2' },
      { match: 'ghostty', render: 'kitty' },
    ],
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

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i')
}

export function resolveEmoteSet(
  modelId: string,
  thinkingLevel: string,
  emotes: EmoteMapping[],
): string {
  let matched: string | null = null
  let modelMatchCount = 0
  let thinkingMatchCount = 0

  for (const entry of emotes) {
    const modelPattern = entry.model ?? '*'
    const thinkingPattern = entry['thinking-level'] ?? '*'
    if (
      globToRegex(modelPattern).test(modelId) &&
      globToRegex(thinkingPattern).test(thinkingLevel)
    ) {
      if (modelPattern !== '*') modelMatchCount++
      if (thinkingPattern !== '*') thinkingMatchCount++
      matched = entry['emote-set']
    }
  }

  if (modelMatchCount > 1) {
    log(
      `[pi-emote] Warning: multiple model patterns matched model "${modelId}", using last match.`,
    )
  }
  if (thinkingMatchCount > 1) {
    log(
      `[pi-emote] Warning: multiple thinking-level patterns matched "${thinkingLevel}", using last match.`,
    )
  }

  return matched ?? 'default'
}

export function getEffectiveCharacter(
  resolver: PathResolver,
  config: Config,
  modelName?: string,
  thinkingLevel?: string,
): string {
  if (config.emotes && config.emotes.length > 0) {
    const setName = resolveEmoteSet(
      modelName ?? '',
      thinkingLevel ?? '',
      config.emotes,
    )
    if (resolver.getCharacterDir(setName)) {
      return setName
    }
  }

  if (modelName && config.modelCharacters) {
    // Try exact match first
    if (config.modelCharacters[modelName]) {
      const preferred = config.modelCharacters[modelName]
      if (resolver.getCharacterDir(preferred)) {
        return preferred
      }
    }

    // Try glob match
    for (const [pattern, character] of Object.entries(config.modelCharacters)) {
      try {
        const regex = globToRegex(pattern)
        if (regex.test(modelName)) {
          if (resolver.getCharacterDir(character)) {
            return character
          }
        }
      } catch (e) {
        // Skip invalid regex
      }
    }
  }
  return config.character
}
