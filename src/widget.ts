import { visibleWidth } from '@earendil-works/pi-tui'
import type { Config, SessionStats } from './types'
import type { RenderedFrame } from './renderer'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'
import { formatTokens, truncateLine } from './utils'

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
  lines.push(theme.bold(modelStr))

  const usage = ctxRef.getContextUsage?.()
  if (usage) {
    const pct = usage.percent !== null ? `${usage.percent.toFixed(1)}%` : '?'
    const tokens = usage.tokens !== null ? formatTokens(usage.tokens) : '?'
    const window = formatTokens(usage.contextWindow)
    lines.push(`Context: ${tokens}/${window} (${pct})`)
  }

  const usageParts: string[] = []
  if (stats.totalInput || stats.totalOutput) {
    usageParts.push(
      `↑${formatTokens(stats.totalInput)} ↓${formatTokens(stats.totalOutput)}`,
    )
  }
  usageParts.push(`$${stats.totalCost.toFixed(3)}`)
  lines.push(usageParts.join(theme.fg('muted', ' · ')))

  // Add CWD & Git Info
  const home = process.env.HOME
  let cwd = ctxRef.cwd ?? ''
  if (home && cwd.startsWith(home)) {
    cwd = `~${cwd.slice(home.length)}`
  }
  let combinedLine = theme.fg('muted', cwd)

  if (gitInfo.branch) {
    combinedLine +=
      theme.fg('muted', ' · ') + theme.fg('muted', `(${gitInfo.branch})`)
    if (gitInfo.stats) {
      combinedLine += ' ' + theme.fg('dim', gitInfo.stats)
    }
  }

  if (extensionStatuses.length > 0) {
    combinedLine += theme.fg('muted', ' · ') + extensionStatuses.join(' ')
  }

  lines.push(combinedLine)

  return lines.map((l) => truncateLine(l, width, config.size))
}

// --- Render helpers ---

function renderWidgetLines(
  frame: RenderedFrame,
  config: Config,
  infoLines: string[],
  borderColor: (s: string) => string,
): string[] {
  const sep = borderColor('│')
  const leftMargin = ' '
  const avatarPad = ' '.repeat(config.size)

  let rowCount = 0
  let getAvatarCell: (i: number) => string

  if (frame.kind === 'image') {
    rowCount = frame.rows
    getAvatarCell = (i) => (i === 0 ? frame.sequence + avatarPad : avatarPad)
  } else {
    const emoteLines = frame.lines
    const emoteRow = 2
    rowCount = Math.max(emoteRow + emoteLines.length, infoLines.length, 4)
    getAvatarCell = (i) => {
      const emoteIdx = i - emoteRow
      const emote =
        emoteIdx >= 0 && emoteIdx < emoteLines.length
          ? emoteLines[emoteIdx]
          : ''
      if (!emote) return avatarPad
      const emoteWidth = visibleWidth(emote)
      const totalPad = config.size - emoteWidth
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
  getRenderedFrame: () => RenderedFrame | null
  setTui: (tui: any) => void
  getCtxRef: () => any
  getGitInfo: () => { branch: string | null; stats: string | null }
  getExtensionStatuses: () => string[]
  getSessionStats: () => SessionStats
  onRender?: (ctx: any) => void
}

export function createWidgetFactory(deps: WidgetDeps) {
  return (_tui: any, theme: any) => {
    deps.setTui(_tui)
    return {
      render(width: number): string[] {
        const { config, pi } = deps
        const ctx = deps.getCtxRef()

        if (width < config.hideBelow) return []

        // Trigger character update check every render
        deps.onRender?.(ctx)

        const frame = deps.getRenderedFrame()
        if (!frame) return []

        const thinkingLevel = pi.getThinkingLevel?.() ?? 'high'
        const borderColor =
          (theme as any).getThinkingBorderColor?.(thinkingLevel) ??
          ((s: string) => theme.fg('border', s))
        const border = borderColor('─'.repeat(width))

        const infoLines = buildInfoLines(
          width,
          config,
          deps.getCtxRef(),
          pi,
          theme,
          deps.getGitInfo(),
          deps.getExtensionStatuses(),
          deps.getSessionStats(),
        )

        const lines: string[] = []
        lines.push(border)
        lines.push(...renderWidgetLines(frame, config, infoLines, borderColor))
        lines.push(border)

        return lines
      },
      invalidate() {},
      dispose() {
        deps.setTui(null)
      },
    }
  }
}
