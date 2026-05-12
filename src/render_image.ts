import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TUI } from '@earendil-works/pi-tui'
import {
  getImageDimensions,
  calculateImageRows,
  getCellDimensions,
} from '@earendil-works/pi-tui'
import type { EmoteState, EmotesConfig, FrameSet } from './types'
import type { Renderer, RenderedFrame } from './renderer'
import { discoverFrames } from './assets'
import { randomPick, weightedRandomPick } from './utils'

export interface ImageDims {
  widthPx: number
  heightPx: number
}

/**
 * Base class for image-protocol renderers (Kitty, iTerm2).
 * Handles frame loading, caching, and selection logic.
 * Subclasses implement encoding and cleanup.
 */
export abstract class BaseImageRenderer implements Renderer {
  protected tuiRef: TUI | null = null
  protected frameMap: Map<string, FrameSet> = new Map()
  protected lastShownBase64: string | null = null
  protected currentFrame: RenderedFrame | null = null
  protected size: number

  constructor(size: number) {
    this.size = size
  }

  setTui(tui: TUI | null) {
    this.tuiRef = tui
  }

  loadFrames(character: string, extDir: string) {
    this.frameMap = discoverFrames(extDir, character)
  }

  getRenderedFrame(): RenderedFrame | null {
    return this.currentFrame
  }

  /** Encode base64 image data into a terminal escape sequence. */
  protected abstract encode(
    base64: string,
    dims: ImageDims,
    rows: number,
    yOffset: number,
  ): string | null

  /** Clean up protocol-specific resources. */
  abstract dispose(): void

  protected show(base64: string, force = false): boolean {
    if (!force && base64 === this.lastShownBase64) return true
    this.lastShownBase64 = base64

    const dims = getImageDimensions(base64, 'image/png') ?? {
      widthPx: 510,
      heightPx: 510,
    }
    const cellDims = getCellDimensions()
    const displayCols = this.size
    const rows = calculateImageRows(dims, displayCols, cellDims)

    // Vertical centering: offset image down by half the unused pixel space
    const scaledHeightPx =
      dims.heightPx * ((displayCols * cellDims.widthPx) / dims.widthPx)
    const totalHeightPx = rows * cellDims.heightPx
    const yOffset = Math.max(
      0,
      Math.floor((totalHeightPx - scaledHeightPx) / 2),
    )

    const sequence = this.encode(base64, dims, rows, yOffset)

    if (sequence) {
      this.currentFrame = { kind: 'image', sequence, rows }
    } else {
      this.currentFrame = null
    }
    this.tuiRef?.requestRender()
    return true
  }

  private getBase64(state: EmoteState, name: string): string | null {
    const frameSet = this.frameMap.get(state)
    if (!frameSet) return null

    let b64 = frameSet.base64Cache.get(name)
    if (!b64 && frameSet.files.includes(name)) {
      try {
        const data = readFileSync(join(frameSet.stateDir, name))
        b64 = data.toString('base64')
        frameSet.base64Cache.set(name, b64)
      } catch (e) {
        return null
      }
    }
    return b64 ?? null
  }

  showFrame(state: EmoteState, name: string, force = false): boolean {
    const b64 = this.getBase64(state, name)
    if (!b64) return false
    return this.show(b64, force)
  }

  showRandomFrame(state: EmoteState, force = false): boolean {
    const frameSet = this.frameMap.get(state)
    if (!frameSet || frameSet.files.length === 0) return false
    const file = randomPick(frameSet.files)
    const b64 = this.getBase64(state, file)
    if (!b64) return false
    return this.show(b64, force)
  }

  showTalkFrame(
    emotesConfig: EmotesConfig,
    weights?: Record<string, number>,
  ): boolean {
    const frameSet = this.frameMap.get('talk')
    if (!frameSet || frameSet.files.length === 0) return false

    const activeWeights = emotesConfig.talk?.weights ?? weights
    if (activeWeights) {
      const file = weightedRandomPick(activeWeights)
      const b64 = this.getBase64('talk', file)
      if (!b64) return this.showRandomFrame('talk')
      return this.show(b64)
    }
    return this.showRandomFrame('talk')
  }

  showTalkCloseFrame(): boolean {
    const frameSet = this.frameMap.get('talk')
    if (!frameSet) return false
    const closeFile = frameSet.files.find((f) => f.includes('close'))
    const file = closeFile ?? frameSet.files[0]!
    const b64 = this.getBase64('talk', file)
    if (!b64) return false
    return this.show(b64)
  }

  showCycleFrame(state: EmoteState, index: number): boolean {
    const frameSet = this.frameMap.get(state)
    if (!frameSet || frameSet.files.length === 0) return false
    const file = frameSet.files[index % frameSet.files.length]!
    const b64 = this.getBase64(state, file)
    if (!b64) return false
    return this.show(b64)
  }

  getCycleFrameCount(state: EmoteState): number {
    return this.frameMap.get(state)?.files.length ?? 0
  }

  resetCache() {
    this.lastShownBase64 = null
  }
}
