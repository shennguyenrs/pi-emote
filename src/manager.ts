import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { discoverFrames } from './assets'
import { loadEmotesConfig, type PathResolver } from './config'
import { AsciiRenderer } from './render_ascii'
import { ITermRenderer } from './render_iterm'
import { KittyRenderer } from './render_kitty'
import { TmuxKittyUnicodeRenderer } from './render_tmux_kitty_unicode'
import type { Renderer } from './renderer'
import { resolveRenderer } from './terminal'
import type { Config, EmotesConfig, EmoteStateController } from './types'

/**
 * Manages the lifecycle and switching of renderers and emote configurations.
 */
export class RendererManager {
  private renderer: Renderer
  private emotesConfig: EmotesConfig = {}
  private tuiRef: any = null
  private currentCharacter: string | null = null

  constructor(
    private config: Config,
    private resolver: PathResolver,
  ) {
    this.renderer = this.detectRenderer()
  }

  private detectRenderer(): Renderer {
    const { protocol, multiplexer } = resolveRenderer(
      this.config.terminals || [],
    )
    const size = this.config.size
    const inTmux = multiplexer === 'tmux'

    if (protocol === 'kitty-unicode') {
      return new TmuxKittyUnicodeRenderer(size)
    }

    if (protocol === 'kitty') {
      return new KittyRenderer(size, inTmux)
    }

    if (protocol === 'iterm2') {
      return new ITermRenderer(size, inTmux)
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
    if (this.currentCharacter === character) return
    this.currentCharacter = character

    const characterDir = this.resolver.getCharacterDir(character)
    const isAsciiOnly =
      character === 'ascii' ||
      (characterDir &&
        existsSync(join(characterDir, 'fallback.json')) &&
        discoverFrames(this.resolver, character).size === 0)

    let newRenderer: Renderer | null = null

    if (isAsciiOnly) {
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
      this.renderer.loadFrames('', this.resolver)
      this.emotesConfig = {}
    } else {
      this.emotesConfig = loadEmotesConfig(this.resolver, character)
      this.renderer.loadFrames(character, this.resolver)
    }

    state.transitionTo('hi')
  }

  dispose() {
    this.renderer.dispose()
    this.renderer.setTui(null)
  }
}
