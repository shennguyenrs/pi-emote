import type { SessionStats } from './types'

export interface SessionStatsTracker {
  update: (ctx: any, currentMessage?: any) => void
  getStats: () => SessionStats
}

interface MessageUsage {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

export function createSessionStatsTracker(): SessionStatsTracker {
  const messageUsageMap = new Map<string, MessageUsage>()
  let totalInput = 0
  let totalOutput = 0
  let totalCost = 0
  let latestInput = 0
  let latestCacheRead = 0
  let latestCacheWrite = 0

  function setUsage(
    id: string,
    input: number,
    output: number,
    cacheRead: number,
    cacheWrite: number,
    cost: number,
  ) {
    const prev = messageUsageMap.get(id)
    if (
      prev &&
      prev.input === input &&
      prev.output === output &&
      prev.cacheRead === cacheRead &&
      prev.cacheWrite === cacheWrite &&
      prev.cost === cost
    ) {
      return
    }

    if (prev) {
      totalInput -= prev.input
      totalOutput -= prev.output
      totalCost -= prev.cost
    }

    messageUsageMap.set(id, { input, output, cacheRead, cacheWrite, cost })
    totalInput += input
    totalOutput += output
    totalCost += cost
  }

  function setLatest(id: string) {
    const u = messageUsageMap.get(id)
    if (!u) return
    latestInput = u.input
    latestCacheRead = u.cacheRead
    latestCacheWrite = u.cacheWrite
  }

  function update(ctx: any, currentMessage?: any) {
    if (!ctx?.sessionManager) return

    if (currentMessage?.id) {
      // Fast path: O(1) update for streaming tokens
      const existing = messageUsageMap.get(currentMessage.id) || {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
      }
      const usage = currentMessage.usage
      setUsage(
        currentMessage.id,
        usage?.input ?? existing.input,
        usage?.output ?? existing.output,
        usage?.cacheRead ?? existing.cacheRead,
        usage?.cacheWrite ?? existing.cacheWrite,
        usage?.cost?.total ?? existing.cost,
      )
      setLatest(currentMessage.id)
    } else {
      // Slow path: Sync with history and recalculate to prevent drift
      try {
        const entries = ctx.sessionManager.getEntries()
        for (const entry of entries) {
          if (entry.type === 'message' && entry.message.role === 'assistant') {
            const msg = entry.message
            if (msg.usage) {
              setUsage(
                msg.id,
                msg.usage.input ?? 0,
                msg.usage.output ?? 0,
                msg.usage.cacheRead ?? 0,
                msg.usage.cacheWrite ?? 0,
                msg.usage.cost?.total ?? 0,
              )
            }
          }
        }

        // Recalculate totals from the Map to ensure absolute consistency
        let ti = 0,
          to = 0,
          tc = 0
        for (const u of messageUsageMap.values()) {
          ti += u.input
          to += u.output
          tc += u.cost
        }
        totalInput = ti
        totalOutput = to
        totalCost = tc

        // Recompute latest from the most-recent assistant message
        for (let i = entries.length - 1; i >= 0; i--) {
          const e = entries[i]
          if (e?.type === 'message' && e.message?.role === 'assistant') {
            setLatest(e.message.id)
            break
          }
        }
      } catch {}
    }
  }

  return {
    update,
    getStats: () => ({
      totalInput,
      totalOutput,
      totalCost,
      latestInput,
      latestCacheRead,
      latestCacheWrite,
    }),
  }
}
