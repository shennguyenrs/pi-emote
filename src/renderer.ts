import {
  getCapabilities,
  getImageDimensions,
  renderImage,
  type TUI,
} from '@mariozechner/pi-tui'
import type { Config } from './types'
import { formatTokens, truncateLine } from './utils'
import type { ExtensionAPI } from '@mariozechner/pi-coding-agent'

export function createRenderer(config: Config, emoteImageId: number) {
  let tuiRef: TUI | null = null
  let ctxRef: any = null
  let imageRows = 0
  let pendingTransmit: string | null = null
  let replotSequence: string | null = null
  let lastShownBase64: string | null = null
  let gitBranch: string | null = null
  let gitStats: string | null = null
  let extensionStatuses: string[] = []

  function showImage(base64: string, force = false) {
    if (!force && base64 === lastShownBase64) return
    lastShownBase64 = base64

    const caps = getCapabilities()
    if (!caps.images) return

    const dimensions = getImageDimensions(base64, 'image/png') ?? {
      widthPx: 510,
      heightPx: 510,
    }
    const result = renderImage(base64, dimensions, {
      maxWidthCells: config.size,
      imageId: emoteImageId,
    })

    if (result) {
      const transmitSeq = result.sequence.replace('a=T', 'a=t')
      const placeSeq = `\x1b_Ga=p,i=${emoteImageId},p=1,c=${config.size},r=${result.rows},C=1,q=2\x1b\\`

      pendingTransmit = transmitSeq
      replotSequence = placeSeq
      imageRows = result.rows
    } else {
      pendingTransmit = null
      replotSequence = null
      imageRows = 0
    }
    tuiRef?.requestRender()
  }

  function buildInfoLines(
    width: number,
    theme: any,
    pi: ExtensionAPI,
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

    let totalInput = 0
    let totalOutput = 0
    let totalCost = 0
    try {
      for (const entry of ctxRef.sessionManager.getEntries()) {
        if (entry.type === 'message' && entry.message.role === 'assistant') {
          totalInput += entry.message.usage?.input ?? 0
          totalOutput += entry.message.usage?.output ?? 0
          totalCost += entry.message.usage?.cost?.total ?? 0
        }
      }
    } catch (_) {}

    const usageParts: string[] = []
    if (totalInput || totalOutput) {
      usageParts.push(`↑${formatTokens(totalInput)} ↓${formatTokens(totalOutput)}`)
    }
    usageParts.push(`$${totalCost.toFixed(3)}`)
    lines.push(usageParts.join(theme.fg('muted', ' · ')))

    // Add CWD & Git Info
    const home = process.env.HOME
    let cwd = ctxRef.cwd ?? ''
    if (home && cwd.startsWith(home)) {
      cwd = `~${cwd.slice(home.length)}`
    }
    let combinedLine = theme.fg('muted', cwd)

    if (gitBranch) {
      combinedLine +=
        theme.fg('muted', ' · ') + theme.fg('muted', `(${gitBranch})`)
      if (gitStats) {
        combinedLine += ' ' + theme.fg('dim', gitStats)
      }
    }

    if (extensionStatuses.length > 0) {
      combinedLine += theme.fg('muted', ' · ') + extensionStatuses.join(' ')
    }

    lines.push(combinedLine)

    return lines.map((l) => truncateLine(l, width, config.size))
  }

  return {
    showImage,
    buildInfoLines,
    setTui: (tui: TUI | null) => (tuiRef = tui),
    setCtx: (ctx: any) => (ctxRef = ctx),
    getPendingTransmit: () => pendingTransmit,
    consumePendingTransmit: () => {
      const p = pendingTransmit
      pendingTransmit = null
      return p
    },
    getReplotSequence: () => replotSequence,
    getImageRows: () => imageRows,
    resetLastShown: () => (lastShownBase64 = null),
    setGitInfo: (branch: string | null, stats: string | null) => {
      gitBranch = branch
      gitStats = stats
      tuiRef?.requestRender()
    },
    setExtensionStatuses: (statuses: string[]) => {
      extensionStatuses = statuses
      tuiRef?.requestRender()
    },
  }
}
