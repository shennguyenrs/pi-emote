import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import type { EmoteState, FrameSet } from './types'
import { EMOTE_STATES } from './types'
import { getCharacterDir } from './config'

export function discoverFrames(
  extDir: string,
  character: string,
): Map<string, FrameSet> {
  const characterDir = getCharacterDir(extDir, character)
  const frameMap = new Map<string, FrameSet>()
  if (!characterDir) return frameMap

  for (const state of EMOTE_STATES) {
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
