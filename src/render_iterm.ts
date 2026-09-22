import { encodeITerm2 } from '@earendil-works/pi-tui'
import type { ImageDims } from './render_image'
import { BaseImageRenderer } from './render_image'
import { wrapTmuxPassthrough } from './tmux'

/**
 * iTerm2 inline image protocol renderer.
 */
export class ITermRenderer extends BaseImageRenderer {
  private frameCounter = 0

  constructor(
    size: number,
    private inTmux = false,
  ) {
    super(size)
  }

  protected encode(
    base64: string,
    _dims: ImageDims,
    _rows: number,
    _yOffset: number,
  ): string | null {
    this.frameCounter++
    const raw = encodeITerm2(base64, {
      width: this.size,
      height: 'auto',
      preserveAspectRatio: true,
      name: `emote-${this.frameCounter}`,
    })
    if (!this.inTmux || !raw) return raw

    const withST = raw.replace(/\x07$/, '\x1b\\')
    return wrapTmuxPassthrough(`\x1b7${withST}\x1b8`)
  }

  dispose() {
    this.currentFrame = null
  }
}
