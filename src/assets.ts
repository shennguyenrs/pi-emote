import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { EmoteState, FrameSet, Config, EmotesConfig } from './types'
import { getCharacterDir } from './config'
import { randomPick, weightedRandomPick } from './utils'

export function discoverFrames(
  extDir: string,
  character: string,
): Map<string, FrameSet> {
  const characterDir = getCharacterDir(extDir, character)
  const frameMap = new Map<string, FrameSet>()
  if (!characterDir) return frameMap

  const states: EmoteState[] = [
    'hi',
    'idle',
    'think',
    'talk',
    'read',
    'write',
    'tool',
    'success',
    'failure',
    'compact',
  ]

  for (const state of states) {
    const stateDir = join(characterDir, state)
    if (!existsSync(stateDir)) continue

    const files = readdirSync(stateDir)
      .filter((f) => f.endsWith('.png'))
      .sort()
    const base64Cache = new Map<string, string>()

    for (const file of files) {
      const data = readFileSync(join(stateDir, file))
      base64Cache.set(file, data.toString('base64'))
    }

    frameMap.set(state, { files, base64Cache })
  }

  return frameMap
}

export function getFrame(
  frameMap: Map<string, FrameSet>,
  state: EmoteState,
  filename: string,
): string | null {
  const frameSet = frameMap.get(state)
  if (!frameSet) return null
  return frameSet.base64Cache.get(filename) ?? null
}

export function getRandomFrame(
  frameMap: Map<string, FrameSet>,
  state: EmoteState,
): string | null {
  const frameSet = frameMap.get(state)
  if (!frameSet || frameSet.files.length === 0) return null
  const file = randomPick(frameSet.files)
  return frameSet.base64Cache.get(file) ?? null
}

export function getTalkFrame(
  frameMap: Map<string, FrameSet>,
  config: Config,
  emotesConfig: EmotesConfig,
): string | null {
  const frameSet = frameMap.get('talk')
  if (!frameSet || frameSet.files.length === 0) return null

  const weights = emotesConfig.talk?.weights ?? config.talk?.weights
  if (weights) {
    const file = weightedRandomPick(weights)
    return frameSet.base64Cache.get(file) ?? getRandomFrame(frameMap, 'talk')
  }
  return getRandomFrame(frameMap, 'talk')
}

export function getTalkCloseFrame(
  frameMap: Map<string, FrameSet>,
): string | null {
  const frameSet = frameMap.get('talk')
  if (!frameSet) return null
  const closeFile = frameSet.files.find((f: string) => f.includes('close'))
  if (closeFile) return frameSet.base64Cache.get(closeFile) ?? null
  return frameSet.base64Cache.get(frameSet.files[0]!) ?? null
}

export function getCycleFrame(
  frameMap: Map<string, FrameSet>,
  state: EmoteState,
  cycleIndex: number,
): string | null {
  const frameSet = frameMap.get(state)
  if (!frameSet || frameSet.files.length === 0) return null
  const file = frameSet.files[cycleIndex % frameSet.files.length]!
  return frameSet.base64Cache.get(file) ?? null
}
