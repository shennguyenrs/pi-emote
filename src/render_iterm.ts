import { encodeITerm2 } from '@earendil-works/pi-tui'
import { BaseImageRenderer } from './render_image'
import type { ImageDims } from './render_image'
import { discoverFrames } from './assets'

/**
 * iTerm2 inline image protocol renderer.
 */
export class ITermRenderer extends BaseImageRenderer {
  private frameCounter = 0

  constructor(size: number) {
    super(size)
  }

  protected encode(
    base64: string,
    _dims: ImageDims,
    _rows: number,
    _yOffset: number,
  ): string | null {
    this.frameCounter++
    return encodeITerm2(base64, {
      width: this.size,
      height: 'auto',
      preserveAspectRatio: true,
      name: `emote-${this.frameCounter}`,
    })
  }

  dispose() {
    // iTerm2 has no explicit image deletion mechanism
    this.currentFrame = null
  }
}
