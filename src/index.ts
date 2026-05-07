import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'
import {
  getCapabilities,
  allocateImageId,
  deleteKittyImage,
} from '@mariozechner/pi-tui'
import { readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  loadConfig,
  loadEmotesConfig,
  saveConfig,
  localEmotesDir,
  globalEmotesDir,
} from './config'
import { discoverFrames } from './assets'
import { createRenderer } from './renderer'
import { createEmoteState } from './state'
import type { EmoteState } from './types'

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
  } catch (e) {
    // fallback or ignore if we can't determine extDir
  }

  const config = loadConfig(extDir)

  if (!config.enabled) return

  let emotesConfig = loadEmotesConfig(extDir, config.character)
  let frameMap = discoverFrames(extDir, config.character)

  const emoteImageId = allocateImageId()
  const renderer = createRenderer(config, emoteImageId)
  const state = createEmoteState(
    config,
    () => emotesConfig,
    () => frameMap,
    renderer,
  )

  let lastBranch: string | null = null

  async function refreshGit(cwd: string, branchOverride?: string | null) {
    if (!cwd) return
    try {
      const branch = branchOverride !== undefined ? branchOverride : lastBranch
      const statsResult = await pi
        .exec('git', ['diff', '--shortstat'], { cwd })
        .catch(() => null)
      const stats = statsResult?.stdout.trim() || null

      if ('setGitInfo' in renderer) {
        ;(renderer as any).setGitInfo(branch, stats)
      }
    } catch (e) {
      // ignore git errors
    }
  }

  function reloadCharacter(character: string) {
    config.character = character
    emotesConfig = loadEmotesConfig(extDir, character)
    frameMap = discoverFrames(extDir, character)

    saveConfig(extDir, config)

    state.clearAllTimers()
    renderer.resetLastShown()
    state.transitionTo('hi')
  }

  // --- Events ---

  pi.on('session_start', async (_event, ctx) => {
    if (!ctx.hasUI) return

    const caps = getCapabilities()
    if (!caps.images) return

    state.clearAllTimers()
    renderer.setCtx(ctx)

    ctx.ui.setWidget(
      'emote',
      (tui, theme) => {
        renderer.setTui(tui)
        return {
          render(width: number): string[] {
            if (width < config.hideBelow) return []
            const imageRows = renderer.getImageRows()
            if (imageRows === 0) return []

            const thinkingLevel = pi.getThinkingLevel?.() ?? 'high'
            const borderColor =
              (theme as any).getThinkingBorderColor?.(thinkingLevel) ??
              ((s: string) => theme.fg('border', s))
            const border = borderColor('─'.repeat(width))
            const sep = borderColor('│')
            const leftMargin = ' '
            const avatarPad = ' '.repeat(config.size)
            const infoLines = renderer.buildInfoLines(width, theme, pi)

            const lines: string[] = []
            lines.push(border)

            const rowCount = Math.max(imageRows, infoLines.length)
            for (let i = 0; i < rowCount; i++) {
              let line = ''
              if (i === 0) {
                line = leftMargin
                const pending = renderer.consumePendingTransmit()
                const replot = renderer.getReplotSequence()
                if (pending) {
                  line += pending + (replot ?? '')
                } else if (replot) {
                  line += replot
                }
                line += `${avatarPad} ${sep} ${infoLines[i] ?? ''}`
              } else {
                line = `${leftMargin}${avatarPad} ${sep} ${infoLines[i] ?? ''}`
              }
              lines.push(line)
            }
            lines.push(border)

            return lines
          },
          invalidate() {},
          dispose() {
            renderer.setTui(null)
            renderer.setCtx(null)
          },
        }
      },
      { placement: 'aboveEditor' },
    )

    ctx.ui.setWorkingVisible(false)
    ctx.ui.setFooter((tui, theme, footerData) => {
      const update = () => {
        lastBranch = footerData.getGitBranch()
        refreshGit(ctx.cwd, lastBranch)
        if ('setExtensionStatuses' in renderer) {
          const r = renderer as any
          r.setExtensionStatuses(
            Array.from(footerData.getExtensionStatuses().values()),
          )
        }
      }
      update()
      const unsub = footerData.onBranchChange(() => {
        update()
        tui.requestRender()
      })
      return {
        render: () => {
          const statuses = Array.from(
            footerData.getExtensionStatuses().values(),
          )
          if (statuses.length === 0) return []
          return [statuses.join(' ')]
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
    process.stdout.write(deleteKittyImage(emoteImageId))
    if (ctx.hasUI) {
      ctx.ui.setWidget('emote', undefined)
      ctx.ui.setWorkingVisible(true)
      ctx.ui.setFooter(undefined)
    }
    state.setWidgetActive(false)
    renderer.setTui(null)
    renderer.setCtx(null)
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
