import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  getEffectiveCharacter,
  loadConfig,
  PathResolver,
  saveConfig,
} from './config'
import { RendererManager } from './manager'
import { createEmoteState } from './state'
import type { EmoteState, SessionStats } from './types'
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

  let ctxRef: any = null

  manager.ensureCharacter(config.character, state)

  let gitInfo = { branch: null as string | null, stats: null as string | null }
  let extensionStatuses: string[] = []
  let sessionStats: SessionStats = {
    totalInput: 0,
    totalOutput: 0,
    totalCost: 0,
  }

  let baseStats = { input: 0, output: 0, cost: 0 }
  let currentMessageId: string | null = null

  function updateSessionStats(ctx: any, currentMessage?: any) {
    if (!ctx?.sessionManager) return

    // If a new message started, recalculate the base stats excluding the current message
    if (currentMessage && currentMessage.id && currentMessage.id !== currentMessageId) {
      currentMessageId = currentMessage.id
      let input = 0, output = 0, cost = 0
      try {
        for (const entry of ctx.sessionManager.getEntries()) {
          if (entry.type === 'message' && entry.message.role === 'assistant' && entry.message.id !== currentMessageId) {
            input += entry.message.usage?.input ?? 0
            output += entry.message.usage?.output ?? 0
            cost += entry.message.usage?.cost?.total ?? 0
          }
        }
      } catch (_) {}
      baseStats = { input, output, cost }
    } else if (!currentMessage) {
      // Full recalculation (e.g., on session_start or agent_end)
      currentMessageId = null
      let input = 0, output = 0, cost = 0
      try {
        for (const entry of ctx.sessionManager.getEntries()) {
          if (entry.type === 'message' && entry.message.role === 'assistant') {
            input += entry.message.usage?.input ?? 0
            output += entry.message.usage?.output ?? 0
            cost += entry.message.usage?.cost?.total ?? 0
          }
        }
      } catch (_) {}
      baseStats = { input, output, cost }
    }

    const currentInput = currentMessage?.usage?.input ?? 0
    const currentOutput = currentMessage?.usage?.output ?? 0
    const currentCost = currentMessage?.usage?.cost?.total ?? 0

    sessionStats = {
      totalInput: baseStats.input + currentInput,
      totalOutput: baseStats.output + currentOutput,
      totalCost: baseStats.cost + currentCost,
    }
  }

  async function refreshStatus(ctx: any, branchOverride?: string | null) {
    if (!ctx?.cwd) return
    try {
      const statsResult = await pi
        .exec('git', ['diff', '--shortstat'], { cwd: ctx.cwd })
        .catch(() => null)
      gitInfo = {
        branch: branchOverride || gitInfo.branch,
        stats: statsResult?.stdout.trim() || null,
      }
    } catch (e) {}
  }

  function reloadCharacter(character: string) {
    config.character = character
    saveConfig(resolver, config)

    manager.ensureCharacter(character, state)

    state.clearAllTimers()
    manager.currentRenderer.resetCache()
    state.transitionTo('hi')
  }

  const widgetFactory = createWidgetFactory({
    pi,
    config,
    getRenderedFrame: () => manager.currentRenderer.getRenderedFrame(),
    setTui: (tui) => {
      manager.setTui(tui)
    },
    getCtxRef: () => ctxRef,
    getGitInfo: () => gitInfo,
    getExtensionStatuses: () => extensionStatuses,
    getSessionStats: () => sessionStats,
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
    updateSessionStats(ctx)

    ctx.ui.setWidget('emote', widgetFactory, { placement: 'aboveEditor' })

    ctx.ui.setWorkingVisible(false)
    ctx.ui.setFooter((tui, theme, footerData) => {
      const update = () => {
        const branch = footerData.getGitBranch()
        gitInfo.branch = branch
        refreshStatus(ctx, branch)
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
    setTimeout(() => state.transitionTo('hi'), 500)
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
      } else {
        ctx.ui.notify('Usage: /emote switch', 'info')
      }
    },
  })

  pi.on('message_update', async (event) => {
    if (event.message?.role !== 'assistant') return

    updateSessionStats(ctxRef, event.message)

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
    updateSessionStats(ctx)
    refreshStatus(ctx)
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
    refreshStatus(ctx)
  })

  pi.on('session_before_compact', async () => {
    state.transitionTo('compact')
  })

  pi.on('session_compact', async () => {
    state.transitionTo('idle')
  })
}
