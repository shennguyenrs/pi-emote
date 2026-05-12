import { getCapabilities } from '@earendil-works/pi-tui'
import { KittyRenderer } from './render_kitty'
import { ITermRenderer } from './render_iterm'
import { AsciiRenderer } from './render_ascii'
import { loadEmotesConfig } from './config'
import type { Renderer } from './renderer'
import type { Config, EmotesConfig, EmoteStateController } from './types'

/**
 * Manages the lifecycle and switching of renderers and emote configurations.
 */
export class RendererManager {
  private renderer: Renderer
  private emotesConfig: EmotesConfig = {}
  private tuiRef: any = null

  constructor(
    private config: Config,
    private extDir: string,
  ) {
    this.renderer = this.detectRenderer()
  }

  private detectRenderer(): Renderer {
    const caps = getCapabilities()
    if (caps.images === 'kitty') {
      return new KittyRenderer(this.config.size)
    }
    if (caps.images === 'iterm2') {
      return new ITermRenderer(this.config.size)
    }
    return new AsciiRenderer()
  }

  get currentRenderer() {
    return this.renderer
  }

  get currentEmotesConfig() {
    return this.emotesConfig
  }

  setTui(tui: any) {
    this.tuiRef = tui
    this.renderer.setTui(tui)
  }

  ensureCharacter(character: string, state: EmoteStateController) {
    let newRenderer: Renderer | null = null

    if (character === 'ascii') {
      if (!(this.renderer instanceof AsciiRenderer)) {
        newRenderer = new AsciiRenderer()
      }
    } else {
      const detected = this.detectRenderer()
      if (this.renderer.constructor !== detected.constructor) {
        newRenderer = detected
      }
    }

    if (newRenderer) {
      this.renderer.dispose()
      this.renderer = newRenderer
      this.renderer.setTui(this.tuiRef)
      state.setRenderer(this.renderer)
    }

    if (character === 'ascii') {
      this.renderer.loadFrames('', this.extDir)
      this.emotesConfig = {}
    } else {
      this.emotesConfig = loadEmotesConfig(this.extDir, character)
      this.renderer.loadFrames(character, this.extDir)
    }
  }

  dispose() {
    this.renderer.dispose()
    this.renderer.setTui(null)
  }
}
