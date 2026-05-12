import type { TUI } from '@earendil-works/pi-tui'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { PathResolver } from './config'
import type { RenderedFrame, Renderer } from './renderer'
import type { EmoteState, EmotesConfig } from './types'
import { EMOTE_STATES } from './types'
import { randomPick } from './utils'

// --- ASCII frame storage ---

interface AsciiFrameSet {
  /** Named frames (for states like idle, think, talk). */
  named: Map<string, string>
  /** Ordered list of frame names (for cycling and random pick). */
  names: string[]
}

/**
 * Text-based renderer for terminals without image protocol support.
 * Loads frames from emotes/ascii/fallback.json.
 */
export class AsciiRenderer implements Renderer {
  private tuiRef: TUI | null = null
  private frames: Map<EmoteState, AsciiFrameSet> = new Map()
  private currentFrame: RenderedFrame | null = null
  private lastShown: string | null = null

  setTui(tui: TUI | null) {
    this.tuiRef = tui
  }

  loadFrames(_character: string, resolver: PathResolver) {
    const characterDir = resolver.getCharacterDir('ascii')
    if (!characterDir) return

    const jsonPath = join(characterDir, 'fallback.json')
    if (!existsSync(jsonPath)) return

    try {
      const jsonText = readFileSync(jsonPath, 'utf-8')
      const parsed = JSON.parse(jsonText)
      this.frames.clear()

      for (const state of EMOTE_STATES) {
        const value = parsed[state]
        if (value === undefined) continue

        const named = new Map<string, string>()
        const names: string[] = []

        if (typeof value === 'string') {
          // Single frame — store as "default"
          named.set('default', value)
          names.push('default')
        } else if (Array.isArray(value)) {
          // Array of frames — index-named
          for (let i = 0; i < value.length; i++) {
            const name = `frame_${i}`
            named.set(name, value[i])
            names.push(name)
          }
        } else {
          // Named frames
          for (const [name, text] of Object.entries(
            value as Record<string, string>,
          )) {
            named.set(name, String(text))
            names.push(name)
          }
        }

        this.frames.set(state, { named, names })
      }
    } catch (e) {
      // ignore parse errors
    }
  }

  getRenderedFrame(): RenderedFrame | null {
    return this.currentFrame
  }

  private show(text: string, force = false): boolean {
    if (!force && text === this.lastShown) return true
    this.lastShown = text
    this.currentFrame = { kind: 'text', lines: text.split('\n') }
    this.tuiRef?.requestRender()
    return true
  }

  showFrame(state: EmoteState, name: string, force = false): boolean {
    const frameSet = this.frames.get(state)
    if (!frameSet) return false

    // Try exact match first
    let text = frameSet.named.get(name)
    if (!text) {
      // Strip .png extension (e.g. "idle.png" → "idle")
      const bare = name.replace(/\.png$/, '')
      text = frameSet.named.get(bare)
      // Map image naming conventions to YAML keys:
      //   idle.png / think.png → "default"
      //   idle_blink.png       → "blink"
      //   think_hard.png       → "hard"
      if (!text && bare === state) text = frameSet.named.get('default')
      if (!text) {
        const suffix = bare.replace(`${state}_`, '')
        if (suffix !== bare) text = frameSet.named.get(suffix)
      }
    }
    if (!text) return false
    return this.show(text, force)
  }

  showRandomFrame(state: EmoteState, force = false): boolean {
    const frameSet = this.frames.get(state)
    if (!frameSet || frameSet.names.length === 0) return false
    const name = randomPick(frameSet.names)
    const text = frameSet.named.get(name)!
    return this.show(text, force)
  }

  showTalkFrame(
    _emotesConfig: EmotesConfig,
    _weights?: Record<string, number>,
  ): boolean {
    const frameSet = this.frames.get('talk')
    if (!frameSet || frameSet.names.length === 0) return false
    // Exclude "close" from random talk frames
    const candidates = frameSet.names.filter((n) => n !== 'close')
    if (candidates.length === 0) return this.showRandomFrame('talk')
    const name = randomPick(candidates)
    return this.show(frameSet.named.get(name)!)
  }

  showTalkCloseFrame(): boolean {
    const frameSet = this.frames.get('talk')
    if (!frameSet) return false
    const text =
      frameSet.named.get('close') ?? frameSet.named.get(frameSet.names[0]!)!
    return this.show(text)
  }

  showCycleFrame(state: EmoteState, index: number): boolean {
    const frameSet = this.frames.get(state)
    if (!frameSet || frameSet.names.length === 0) return false
    const name = frameSet.names[index % frameSet.names.length]!
    return this.show(frameSet.named.get(name)!)
  }

  getCycleFrameCount(state: EmoteState): number {
    return this.frames.get(state)?.names.length ?? 0
  }

  dispose() {
    this.currentFrame = null
  }

  resetCache() {
    this.lastShown = null
  }
}
