import type { TUI } from '@earendil-works/pi-tui'
import type { PathResolver } from './config'
import type { EmoteState, EmotesConfig } from './types'

/**
 * A rendered frame — either an image sequence (Kitty/iTerm2) or plain text lines.
 */
export type RenderedFrame =
  | { kind: 'image'; sequence: string; rows: number }
  | { kind: 'text'; lines: string[] }

/**
 * Renderer interface — abstracts how emote frames are loaded, stored, and displayed.
 */
export interface Renderer {
  /** Set the TUI reference for requesting re-renders. */
  setTui(tui: TUI | null): void

  /** Load frames for an emote set. */
  loadFrames(character: string, resolver: PathResolver): void

  /** Get the current rendered frame (for the widget to read). */
  getRenderedFrame(): RenderedFrame | null

  /** Show a specific named frame for a state. Returns false if not found. */
  showFrame(state: EmoteState, name: string, force?: boolean): boolean

  /** Show a random frame for a state. Returns false if no frames. */
  showRandomFrame(state: EmoteState, force?: boolean): boolean

  /** Show a weighted-random talk frame using emotes config. */
  showTalkFrame(
    emotesConfig: EmotesConfig,
    weights?: Record<string, number>,
  ): boolean

  /** Show the talk close/rest frame. */
  showTalkCloseFrame(): boolean

  /** Show a cycling frame for a state (read/write/tool). */
  showCycleFrame(state: EmoteState, index: number): boolean

  /** Get number of cycle frames for a state. */
  getCycleFrameCount(state: EmoteState): number

  /** Clean up resources (delete images, etc). */
  dispose(): void

  /** Reset cached state so next show is forced. */
  resetCache(): void
}
