import type { SessionStats } from './types'

export interface SessionStatsTracker {
  update: (ctx: any, currentMessage?: any) => void
  getStats: () => SessionStats
}

export function createSessionStatsTracker(): SessionStatsTracker {
  let stats: SessionStats = {
    totalInput: 0,
    totalOutput: 0,
    totalCost: 0,
    latestInput: 0,
    latestCacheRead: 0,
    latestCacheWrite: 0,
  }

  function update(ctx: any, currentMessage?: any) {
    if (!ctx?.sessionManager) return

    try {
      const entries = ctx.sessionManager.getEntries()
      let totalInput = 0
      let totalOutput = 0
      let totalCost = 0
      let latestMsg: any = null

      for (const entry of entries) {
        if (entry.type === 'message' && entry.message?.role === 'assistant') {
          const msg =
            currentMessage?.id === entry.message.id
              ? currentMessage
              : entry.message
          const u = msg.usage
          if (u) {
            totalInput += u.input ?? 0
            totalOutput += u.output ?? 0
            totalCost += u.cost?.total ?? 0
          }
          latestMsg = msg
        }
      }

      if (
        currentMessage &&
        (!latestMsg || latestMsg.id !== currentMessage.id)
      ) {
        const u = currentMessage.usage
        if (u) {
          totalInput += u.input ?? 0
          totalOutput += u.output ?? 0
          totalCost += u.cost?.total ?? 0
        }
        latestMsg = currentMessage
      }

      const lu = latestMsg?.usage
      stats = {
        totalInput,
        totalOutput,
        totalCost,
        latestInput: lu?.input ?? 0,
        latestCacheRead: lu?.cacheRead ?? 0,
        latestCacheWrite: lu?.cacheWrite ?? 0,
      }
    } catch {}
  }

  return {
    update,
    getStats: () => stats,
  }
}
