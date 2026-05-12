import type { SessionStats } from './types'

export interface SessionStatsTracker {
  update: (ctx: any, currentMessage?: any) => void
  getStats: () => SessionStats
}

export function createSessionStatsTracker(): SessionStatsTracker {
  let baseStats = { input: 0, output: 0, cost: 0 }
  let currentMessageId: string | null = null
  let sessionStats: SessionStats = {
    totalInput: 0,
    totalOutput: 0,
    totalCost: 0,
  }

  function update(ctx: any, currentMessage?: any) {
    if (!ctx?.sessionManager) return

    // If a new message started, recalculate the base stats excluding the current message
    if (
      currentMessage &&
      currentMessage.id &&
      currentMessage.id !== currentMessageId
    ) {
      currentMessageId = currentMessage.id
      let input = 0,
        output = 0,
        cost = 0
      try {
        for (const entry of ctx.sessionManager.getEntries()) {
          if (
            entry.type === 'message' &&
            entry.message.role === 'assistant' &&
            entry.message.id !== currentMessageId
          ) {
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
      let input = 0,
        output = 0,
        cost = 0
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

  return {
    update,
    getStats: () => sessionStats,
  }
}
