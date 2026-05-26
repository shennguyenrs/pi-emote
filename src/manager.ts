import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { loadEmotesConfig, type PathResolver } from './config'
import { AsciiRenderer } from './render_ascii'
import { ITermRenderer } from './render_iterm'
import { KittyRenderer } from './render_kitty'
import { TmuxITermRenderer } from './render_tmux_iterm'
import { TmuxKittyRenderer } from './render_tmux_kitty'
import { TmuxKittyUnicodeRenderer } from './render_tmux_kitty_unicode'
import type { Renderer } from './renderer'
import { resolveRenderer } from './terminal'
import type { Config, EmotesConfig, EmoteStateController } from './types'
import { EMOTE_STATES } from './types'

function hasImageFrames(characterDir: string): boolean {
  for (const state of EMOTE_STATES) {
    const stateDir = join(characterDir, state)
    if (existsSync(stateDir)) {
      try {
        const files = readdirSync(stateDir).filter((f) => f.endsWith('.png'))
        if (files.length > 0) return true
      } catch (e) {}
    }
  }
  return false
}

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
    const resolved = resolveRenderer(this.config.terminals || [], new Set())
    const { protocol, multiplexer } = resolved
    const size = this.config.size

    if (protocol === 'kitty-unicode') {
      return new TmuxKittyUnicodeRenderer(size)
    }

    if (protocol === 'kitty') {
      if (multiplexer === 'tmux') {
        return new TmuxKittyRenderer(size)
      }
      return new KittyRenderer(size)
    }

    if (protocol === 'iterm2') {
      if (multiplexer === 'tmux') {
        return new TmuxITermRenderer(size)
      }
      return new ITermRenderer(size)
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
        !hasImageFrames(characterDir))

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
