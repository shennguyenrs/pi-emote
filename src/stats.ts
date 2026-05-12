import type { SessionStats } from './types'

export interface SessionStatsTracker {
  update: (ctx: any, currentMessage?: any) => void
  getStats: () => SessionStats
}

export function createSessionStatsTracker(): SessionStatsTracker {
  const messageUsageMap = new Map<
    string,
    { input: number; output: number; cost: number }
  >()
  let totalInput = 0
  let totalOutput = 0
  let totalCost = 0

  function setUsage(id: string, input: number, output: number, cost: number) {
    const prev = messageUsageMap.get(id)
    if (
      prev &&
      prev.input === input &&
      prev.output === output &&
      prev.cost === cost
    ) {
      return
    }

    if (prev) {
      totalInput -= prev.input
      totalOutput -= prev.output
      totalCost -= prev.cost
    }

    messageUsageMap.set(id, { input, output, cost })
    totalInput += input
    totalOutput += output
    totalCost += cost
  }

  function update(ctx: any, currentMessage?: any) {
    if (!ctx?.sessionManager) return

    if (currentMessage?.id) {
      // Fast path: O(1) update for streaming tokens
      const existing = messageUsageMap.get(currentMessage.id) || {
        input: 0,
        output: 0,
        cost: 0,
      }
      const usage = currentMessage.usage
      setUsage(
        currentMessage.id,
        usage?.input ?? existing.input,
        usage?.output ?? existing.output,
        usage?.cost?.total ?? existing.cost,
      )
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
      } catch (_) {}
    }
  }

  return {
    update,
    getStats: () => ({
      totalInput,
      totalOutput,
      totalCost,
    }),
  }
}
