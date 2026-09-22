import { visibleWidth, truncateToWidth } from '@earendil-works/pi-tui'
import type { Config, SessionStats, WidgetColor } from './types'
import type { RenderedFrame } from './renderer'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import type { RendererManager } from './manager'
import type { GitTracker } from './git'
import type { SessionStatsTracker } from './stats'
import { formatTokens } from './utils'
import { resolveProgressColor } from './theme'

// --- Progress bar ---

function buildProgressBar(
  usage: any,
  latestCacheRead: number,
  latestInput: number,
  latestCacheWrite: number,
): string {
  const segments = 20
  const subsPerSegment = 8
  const totalSubs = segments * subsPerSegment
  const percent = usage?.percent ?? 0

  const filledSubs =
    percent === 0
      ? 0
      : Math.max(Math.ceil((percent / 100) * totalSubs), subsPerSegment)

  const totalPrompt = latestInput + latestCacheRead + latestCacheWrite
  const cacheRatio = totalPrompt > 0 ? latestCacheRead / totalPrompt : 0
  const cacheSubs = Math.floor(filledSubs * cacheRatio)

  const eighthBlockChars = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '█']

  const bar = Array.from({ length: segments }, (_, i) => {
    const segStart = i * subsPerSegment
    const segEnd = segStart + subsPerSegment

    const cacheInSeg = Math.max(0, Math.min(cacheSubs, segEnd) - segStart)
    const inputInSeg = Math.max(
      0,
      Math.min(filledSubs, segEnd) - Math.max(cacheSubs, segStart),
    )

    if (cacheInSeg > 0 && inputInSeg > 0) return '█'
    if (inputInSeg > 0) return eighthBlockChars[inputInSeg - 1]
    if (cacheInSeg > 0) return '░'
    return ' '
  }).join('')

  const pctStr = percent.toFixed(1)
  const tokensStr = usage?.tokens != null ? formatTokens(usage.tokens) : '?'
  return `⏵▕${bar}▏ ${tokensStr} (${pctStr}%)`
}

// --- Color styler ---

function colorStyler(
  color: WidgetColor,
  thinkingStyler: (s: string) => string,
  theme: any,
): (s: string) => string {
  if (color === 'thinking-level-color') return thinkingStyler
  return (s: string) => theme.fg(color, s)
}

// --- Token formatting ---

export function buildInfoLines(
  width: number,
  config: Config,
  ctxRef: any,
  pi: ExtensionAPI,
  theme: any,
  gitInfo: { branch: string | null; stats: string | null },
  extensionStatuses: string[],
  stats: SessionStats,
): string[] {
  const lines: string[] = []
  if (!ctxRef) return lines

  const model = ctxRef.model
  let modelStr = model?.name ?? 'no model'
  const thinkingLevel = pi.getThinkingLevel?.() ?? 'high'
  if (model?.reasoning) {
    modelStr += ` • ${thinkingLevel}`
  }
  lines.push(modelStr)

  const usage = ctxRef.getContextUsage?.()
  if (usage) {
    lines.push(
      buildProgressBar(
        usage,
        stats.latestCacheRead,
        stats.latestInput,
        stats.latestCacheWrite,
      ),
    )
  }

  const usageParts: string[] = []
  if (stats.totalInput || stats.totalOutput) {
    usageParts.push(
      `↑${formatTokens(stats.totalInput)} ↓${formatTokens(stats.totalOutput)}`,
    )
  }
  const latestPrompt =
    stats.latestInput + stats.latestCacheRead + stats.latestCacheWrite
  const cacheHitRate =
    latestPrompt > 0 ? (stats.latestCacheRead / latestPrompt) * 100 : 0
  usageParts.push(`⇞${cacheHitRate.toFixed(1)}%`)
  usageParts.push(`$${stats.totalCost.toFixed(3)}`)
  lines.push(usageParts.join(' · '))

  // Add CWD & Git Info
  const home = process.env.HOME
  let cwd = ctxRef.cwd ?? ''
  if (home && cwd.startsWith(home)) {
    cwd = `~${cwd.slice(home.length)}`
  }
  let combinedLine = cwd

  if (gitInfo.branch) {
    combinedLine += ` · (${gitInfo.branch})`
    if (gitInfo.stats) {
      combinedLine += ` ${gitInfo.stats}`
    }
  }

  if (extensionStatuses.length > 0) {
    combinedLine += ` · ${extensionStatuses.join(' ')}`
  }

  lines.push(combinedLine)

  // Apply theme colors per line
  const thinkingStyler =
    (theme as any).getThinkingBorderColor?.(thinkingLevel) ??
    ((s: string) => theme.fg('border', s))
  const wt = config.theme ?? {}
  const styleModel = colorStyler(
    wt['model-name'] ?? 'accent',
    thinkingStyler,
    theme,
  )
  const styleProgress = colorStyler(
    resolveProgressColor(
      usage?.percent ?? 0,
      cacheHitRate,
      wt['progress-bar'] ?? {},
    ),
    thinkingStyler,
    theme,
  )
  const styleStats = colorStyler(
    wt['token-info'] ?? 'dim',
    thinkingStyler,
    theme,
  )
  const stylePwd = colorStyler(
    wt['working-directory'] ?? 'muted',
    thinkingStyler,
    theme,
  )
  const styleFns = [styleModel, styleProgress, styleStats, stylePwd]
  const infoWidth = width - config.size - 5
  return lines.map((l, i) => {
    const colored = styleFns[i] ? styleFns[i](l) : l
    return visibleWidth(colored) > infoWidth
      ? truncateToWidth(colored, infoWidth, '…')
      : colored
  })
}

// --- Render helpers ---

const TEXT_CANVAS_COLS = 8
const TEXT_CANVAS_ROWS = 4

function renderWidgetLines(
  frame: RenderedFrame,
  config: Config,
  infoLines: string[],
  separatorColor: (s: string) => string,
): string[] {
  const sep = separatorColor('│')
  const leftMargin = ' '
  const avatarPad = ' '.repeat(
    frame.kind === 'text' ? TEXT_CANVAS_COLS : config.size,
  )

  let rowCount = 0
  let getAvatarCell: (i: number) => string

  if (frame.kind === 'image') {
    rowCount = frame.rows
    getAvatarCell = (i) => (i === 0 ? frame.sequence + avatarPad : avatarPad)
  } else {
    const emoteLines = frame.lines
    const canvasCols = TEXT_CANVAS_COLS
    rowCount = Math.max(TEXT_CANVAS_ROWS, infoLines.length)
    const emoteStart = Math.floor((rowCount - emoteLines.length) / 2)
    getAvatarCell = (i) => {
      const emoteIdx = i - emoteStart
      const emote =
        emoteIdx >= 0 && emoteIdx < emoteLines.length
          ? emoteLines[emoteIdx]
          : ''
      if (!emote) return avatarPad
      const emoteWidth = visibleWidth(emote)
      const totalPad = canvasCols - emoteWidth
      const padLeft = totalPad > 0 ? ' '.repeat(Math.floor(totalPad / 2)) : ''
      const padRight = totalPad > 0 ? ' '.repeat(Math.ceil(totalPad / 2)) : ''
      return `${padLeft}${emote}${padRight}`
    }
  }

  const lines: string[] = []
  for (let i = 0; i < rowCount; i++) {
    lines.push(`${leftMargin}${getAvatarCell(i)} ${sep} ${infoLines[i] ?? ''}`)
  }
  return lines
}

// --- Widget factory ---

export interface WidgetDeps {
  pi: ExtensionAPI
  config: Config
  manager: RendererManager
  gitTracker: GitTracker
  statsTracker: SessionStatsTracker
  getCtx: () => any
  getExtensionStatuses: () => string[]
}

export function createWidgetFactory(deps: WidgetDeps) {
  return (tui: any, theme: any) => {
    deps.manager.setTui(tui)
    return {
      render(width: number): string[] {
        const { config, pi, manager, gitTracker, statsTracker } = deps

        if (width < config.hideBelow) return []

        const frame = manager.currentRenderer.getRenderedFrame()
        if (!frame) return []

        const thinkingLevel = pi.getThinkingLevel?.() ?? 'high'
        const thinkingStyler =
          (theme as any).getThinkingBorderColor?.(thinkingLevel) ??
          ((s: string) => theme.fg('border', s))
        const wt = config.theme ?? {}
        const borderColor = colorStyler(
          wt.border ?? 'thinking-level-color',
          thinkingStyler,
          theme,
        )
        const separatorColor = colorStyler(
          wt['vertical-separator'] ?? 'thinking-level-color',
          thinkingStyler,
          theme,
        )
        const border = borderColor('─'.repeat(width))

        const infoLines = buildInfoLines(
          width,
          config,
          deps.getCtx(),
          pi,
          theme,
          gitTracker.getInfo(),
          deps.getExtensionStatuses(),
          statsTracker.getStats(),
        )

        const lines: string[] = []
        lines.push(border)
        lines.push(
          ...renderWidgetLines(frame, config, infoLines, separatorColor),
        )
        lines.push(border)

        return lines
      },
      invalidate() {},
      dispose() {
        deps.manager.setTui(null)
      },
    }
  }
}
