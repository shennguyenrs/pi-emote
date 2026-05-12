import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { getCapabilities } from '@earendil-works/pi-tui'
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadConfig,
  saveConfig,
  localEmotesDir,
  globalEmotesDir,
  getEffectiveCharacter,
} from './config'
import { createEmoteState } from './state'
import type { EmoteState, SessionStats } from './types'
import { RendererManager } from './manager'
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

  const config = loadConfig(extDir)
  if (!config.enabled) return

  const manager = new RendererManager(config, extDir)
  const state = createEmoteState(
    config,
    () => manager.currentEmotesConfig,
    manager.currentRenderer,
  )

  let ctxRef: any = null

  manager.ensureCharacter(config.character, state)

  let gitInfo = { branch: null as string | null, stats: null as string | null }
  let extensionStatuses: string[] = []
  let sessionStats: SessionStats = { totalInput: 0, totalOutput: 0, totalCost: 0 }

  function updateSessionStats(ctx: any) {
    if (!ctx?.sessionManager) return
    let input = 0
    let output = 0
    let cost = 0
    try {
      for (const entry of ctx.sessionManager.getEntries()) {
        if (entry.type === 'message' && entry.message.role === 'assistant') {
          input += entry.message.usage?.input ?? 0
          output += entry.message.usage?.output ?? 0
          cost += entry.message.usage?.cost?.total ?? 0
        }
      }
    } catch (_) {}
    sessionStats = { totalInput: input, totalOutput: output, totalCost: cost }
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
    saveConfig(extDir, config)

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

    const effectiveChar = getEffectiveCharacter(extDir, config, ctx.model?.name)
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
          extensionStatuses = Array.from(footerData.getExtensionStatuses().values())
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
    updateSessionStats(ctxRef)
  })

  pi.on('agent_end', async (event, ctx) => {
    if (state.getCurrentState() === 'talk') {
      state.endTalk()
    } else if (!['idle', 'hi', 'compact'].includes(state.getCurrentState())) {
      state.transitionTo('idle')
    }
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
