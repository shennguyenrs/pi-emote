import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getEffectiveCharacter,
  loadConfig,
  PathResolver,
  saveConfig,
} from './config'
import { createGitTracker } from './git'
import { RendererManager } from './manager'
import { createEmoteState } from './state'
import { createSessionStatsTracker } from './stats'
import type { EmoteState } from './types'
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

export default function (pi: ExtensionAPI) {
  let extDir = ''
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    extDir = dirname(__dirname)
  } catch (e) {}

  const resolver = new PathResolver(extDir)
  const config = loadConfig(resolver)
  if (!config.enabled) return

  const manager = new RendererManager(config, resolver)
  const state = createEmoteState(
    config,
    () => manager.currentEmotesConfig,
    manager.currentRenderer,
  )

  const statsTracker = createSessionStatsTracker()
  const gitTracker = createGitTracker(pi)

  let ctxRef: any = null
  let extensionStatuses: string[] = []

  manager.ensureCharacter(config.character, state)

  function reloadCharacter(character: string) {
    config.character = character
    saveConfig(resolver, config)

    manager.ensureCharacter(character, state)

    state.clearAllTimers()
    manager.currentRenderer.resetCache()
  }

  const widgetFactory = createWidgetFactory({
    pi,
    config,
    getRenderedFrame: () => manager.currentRenderer.getRenderedFrame(),
    setTui: (tui) => {
      manager.setTui(tui)
    },
    getCtxRef: () => ctxRef,
    getGitInfo: () => gitTracker.getInfo(),
    getExtensionStatuses: () => extensionStatuses,
    getSessionStats: () => statsTracker.getStats(),
    onRender: (ctx) => {
      const effectiveChar = getEffectiveCharacter(
        resolver,
        config,
        ctx?.model?.name,
      )
      manager.ensureCharacter(effectiveChar, state)
    },
  })

  // --- Events ---

  pi.on('session_start', async (_event, ctx) => {
    if (!ctx.hasUI) return

    const effectiveChar = getEffectiveCharacter(
      resolver,
      config,
      ctx.model?.name,
    )
    manager.ensureCharacter(effectiveChar, state)

    manager.currentRenderer.resetCache()
    state.clearAllTimers()
    ctxRef = ctx
    statsTracker.update(ctx)

    ctx.ui.setWidget('emote', widgetFactory, { placement: 'aboveEditor' })

    ctx.ui.setWorkingVisible(false)
    ctx.ui.setFooter((tui, theme, footerData) => {
      const update = () => {
        const branch = footerData.getGitBranch()
        gitTracker.refreshStatus(ctx, branch)
      }
      update()
      const unsub = footerData.onBranchChange(() => {
        update()
        tui.requestRender()
      })
      return {
        render: () => {
          extensionStatuses = Array.from(
            footerData.getExtensionStatuses().values(),
          )
          return [] // Return empty to avoid double display in footer
        },
        invalidate: () => {},
        dispose: unsub,
      }
    })

    state.setWidgetActive(true)
  })

  pi.on('session_shutdown', async (_event, ctx) => {
    state.clearAllTimers()
    manager.dispose()
    if (ctx.hasUI) {
      ctx.ui.setWidget('emote', undefined)
      ctx.ui.setWorkingVisible(true)
      ctx.ui.setFooter(undefined)
    }
    state.setWidgetActive(false)
    ctxRef = null
  })

  pi.registerCommand('emote', {
    description: 'Switch between emote characters',
    handler: async (args, ctx) => {
      const parts = (args || '').trim().split(/\s+/)
      const subCommand = parts[0]

      if (subCommand === 'switch') {
        const characters = resolver.getAllCharacters()
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
      } else if (subCommand === 'set-model') {
        const modelName = ctx.model?.name
        if (!modelName) {
          ctx.ui.notify('Could not detect current model name', 'error')
          return
        }

        const characters = resolver.getAllCharacters()
        const selection = await ctx.ui.select(
          `Set character for ${modelName}`,
          characters,
        )
        if (selection) {
          if (!config.modelCharacters) config.modelCharacters = {}
          config.modelCharacters[modelName] = selection
          saveConfig(resolver, config)

          manager.ensureCharacter(selection, state)
          ctx.ui.notify(
            `Set ${modelName} to use character: ${selection}`,
            'info',
          )
        }
      } else {
        ctx.ui.notify('Usage: /emote [switch|set-model]', 'info')
      }
    },
  })

  pi.on('message_update', async (event) => {
    if (event.message?.role !== 'assistant') return

    statsTracker.update(ctxRef, event.message)

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
    statsTracker.update(ctx)
    gitTracker.refreshStatus(ctx)
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
    gitTracker.refreshStatus(ctx)
  })

  pi.on('session_before_compact', async () => {
    state.transitionTo('compact')
  })

  pi.on('session_compact', async () => {
    statsTracker.update(ctxRef)
    state.transitionTo('idle')
  })
}
