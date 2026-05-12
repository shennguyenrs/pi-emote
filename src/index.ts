import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { getCapabilities } from '@earendil-works/pi-tui'
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadConfig,
  loadEmotesConfig,
  saveConfig,
  localEmotesDir,
  globalEmotesDir,
  getEffectiveCharacter,
} from './config'
import { createEmoteState } from './state'
import type { EmoteState } from './types'
import type { Renderer } from './renderer'
import { KittyRenderer } from './render_kitty'
import { ITermRenderer } from './render_iterm'
import { AsciiRenderer } from './render_ascii'
import { createWidgetFactory } from './widget'

function toolNameToState(toolName: string): EmoteState {
  switch (toolName) {
    case 'read':
      return 'read'
    case 'write':
    case 'edit':
      return 'write'
    default:
      return 'tool'
  }
}

function createRenderer(config: any): Renderer {
  const caps = getCapabilities()
  if (caps.images === 'kitty') {
    return new KittyRenderer(config.size)
  }
  if (caps.images === 'iterm2') {
    return new ITermRenderer(config.size)
  }
  return new AsciiRenderer()
}

export default function (pi: ExtensionAPI) {
  let extDir = ''
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    extDir = dirname(__dirname)
  } catch (e) {}

  const config = loadConfig(extDir)
  if (!config.enabled) return

  let emotesConfig = loadEmotesConfig(extDir, config.character)
  let loadedCharacter = config.character

  let renderer = createRenderer(config)
  const state = createEmoteState(config, () => emotesConfig, renderer)

  let ctxRef: any = null
  let tuiRef: any = null

  function ensureRendererForCharacter(character: string) {
    let newRenderer: Renderer | null = null

    if (character === 'ascii') {
      if (!(renderer instanceof AsciiRenderer)) {
        newRenderer = new AsciiRenderer()
      }
    } else {
      const detected = createRenderer(config)
      if (renderer.constructor !== detected.constructor) {
        newRenderer = detected
      }
    }

    if (newRenderer) {
      renderer.dispose()
      renderer = newRenderer
      renderer.setTui(tuiRef)
      state.setRenderer(renderer)
    }

    if (character === 'ascii') {
      renderer.loadFrames('', extDir)
      emotesConfig = {}
    } else {
      emotesConfig = loadEmotesConfig(extDir, character)
      renderer.loadFrames(character, extDir)
    }
    loadedCharacter = character
  }

  ensureRendererForCharacter(config.character)

  let gitBranch: string | null = null
  let gitStats: string | null = null
  let extensionStatuses: string[] = []

  async function refreshGit(cwd: string, branchOverride?: string | null) {
    if (!cwd) return
    try {
      const branch = branchOverride !== undefined ? branchOverride : gitBranch
      const statsResult = await pi
        .exec('git', ['diff', '--shortstat'], { cwd })
        .catch(() => null)
      const stats = statsResult?.stdout.trim() || null
      gitBranch = branch
      gitStats = stats
    } catch (e) {}
  }

  function reloadCharacter(character: string) {
    config.character = character
    saveConfig(extDir, config)

    ensureRendererForCharacter(character)

    state.clearAllTimers()
    renderer.resetCache()
    state.transitionTo('hi')
  }

  const widgetFactory = createWidgetFactory({
    pi,
    config,
    getRenderedFrame: () => renderer.getRenderedFrame(),
    setTui: (tui) => {
      tuiRef = tui
      renderer.setTui(tui)
    },
    getCtxRef: () => ctxRef,
    getGitInfo: () => ({ branch: gitBranch, stats: gitStats }),
    getExtensionStatuses: () => extensionStatuses,
  })

  // --- Events ---

  pi.on('session_start', async (_event, ctx) => {
    if (!ctx.hasUI) return

    const effectiveChar = getEffectiveCharacter(extDir, config, ctx.model?.name)
    ensureRendererForCharacter(effectiveChar)

    renderer.resetCache()
    state.clearAllTimers()
    ctxRef = ctx

    ctx.ui.setWidget('emote', widgetFactory, { placement: 'aboveEditor' })

    ctx.ui.setWorkingVisible(false)
    ctx.ui.setFooter((tui, theme, footerData) => {
      const update = () => {
        gitBranch = footerData.getGitBranch()
        refreshGit(ctx.cwd, gitBranch)
        extensionStatuses = Array.from(
          footerData.getExtensionStatuses().values(),
        )
      }
      update()
      const unsub = footerData.onBranchChange(() => {
        update()
        tui.requestRender()
      })
      return {
        render: () => {
          if (extensionStatuses.length === 0) return []
          return [extensionStatuses.join(' ')]
        },
        invalidate: () => {},
        dispose: unsub,
      }
    })

    state.setWidgetActive(true)
    setTimeout(() => state.transitionTo('hi'), 500)
  })

  pi.on('session_shutdown', async (_event, ctx) => {
    state.clearAllTimers()
    renderer.dispose()
    if (ctx.hasUI) {
      ctx.ui.setWidget('emote', undefined)
      ctx.ui.setWorkingVisible(true)
      ctx.ui.setFooter(undefined)
    }
    state.setWidgetActive(false)
    renderer.setTui(null)
    tuiRef = null
    ctxRef = null
  })

  pi.registerCommand('emote', {
    description: 'Switch between emote characters',
    handler: async (args, ctx) => {
      const parts = (args || '').trim().split(/\s+/)
      const subCommand = parts[0]

      if (subCommand === 'switch') {
        const extEmotesDir = join(extDir, 'emotes')
        const getChars = (dir: string) => {
          if (!dir || !existsSync(dir)) return []
          try {
            return readdirSync(dir, { withFileTypes: true })
              .filter((d) => d.isDirectory() && d.name !== '_unused')
              .map((d) => d.name)
          } catch (e) {
            return []
          }
        }

        const characters = Array.from(
          new Set([
            ...getChars(localEmotesDir),
            ...getChars(globalEmotesDir),
            ...getChars(extEmotesDir),
          ]),
        ).sort()

        if (characters.length === 0) {
          ctx.ui.notify('No characters found', 'error')
          return
        }

        const selection = await ctx.ui.select(
          'Switch Emote Character',
          characters,
        )
        if (selection) {
          reloadCharacter(selection)
          ctx.ui.notify(`Switched to character: ${selection}`, 'info')
        }
      } else {
        ctx.ui.notify('Usage: /emote switch', 'info')
      }
    },
  })

  pi.on('message_update', async (event) => {
    if (event.message?.role !== 'assistant') return
    const streamEvent = event.assistantMessageEvent
    if (!streamEvent) return

    if (
      streamEvent.type === 'thinking_start' ||
      streamEvent.type === 'thinking_delta'
    ) {
      if (state.getCurrentState() !== 'think') state.transitionTo('think')
      return
    }

    if (streamEvent.type === 'toolcall_start') {
      const partial = streamEvent.partial
      const block = partial?.content?.[streamEvent.contentIndex]
      if (block && 'name' in block && block.name) {
        state.transitionTo(toolNameToState(block.name))
      } else {
        state.transitionTo('tool')
      }
      return
    }

    if (streamEvent.type !== 'text_delta') return
    const text = streamEvent.delta
    if (!text) return

    if (state.getCurrentState() !== 'talk') state.transitionTo('talk')
    state.onTalkToken(text)
  })

  pi.on('agent_end', async (event, ctx) => {
    if (state.getCurrentState() === 'talk') {
      state.endTalk()
    } else if (!['idle', 'hi', 'compact'].includes(state.getCurrentState())) {
      state.transitionTo('idle')
    }
    refreshGit(ctx.cwd)
  })

  pi.on('tool_execution_start', async (event) => {
    state.transitionTo(toolNameToState(event.toolName))
  })

  pi.on('tool_execution_end', async (event, ctx) => {
    if (event.toolName === 'bash' && event.isError) {
      state.setHoldNextState('read')
      state.transitionTo('failure')
    } else {
      state.transitionTo('read')
    }
    refreshGit(ctx.cwd)
  })

  pi.on('session_before_compact', async () => {
    state.transitionTo('compact')
  })

  pi.on('session_compact', async () => {
    state.transitionTo('idle')
  })
}
