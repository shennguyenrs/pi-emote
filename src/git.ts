import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export interface GitInfo {
  branch: string | null
  stats: string | null
}

export interface GitTracker {
  refreshStatus: (ctx: any, branchOverride?: string | null) => Promise<void>
  getInfo: () => GitInfo
}

export function createGitTracker(pi: ExtensionAPI): GitTracker {
  const info: GitInfo = { branch: null, stats: null }

  async function refreshStatus(ctx: any, branchOverride?: string | null) {
    if (!ctx?.cwd) return
    try {
      const statsResult = await pi
        .exec('git', ['diff', '--shortstat'], { cwd: ctx.cwd })
        .catch(() => null)
      info.branch = branchOverride || info.branch
      const raw = statsResult?.stdout.trim() || ''

      if (raw) {
        const insertions = raw.match(/(\d+)\s*insertions?\(\+\)/)
        const deletions = raw.match(/(\d+)\s*deletions?\(-\)/)

        info.stats =
          insertions || deletions
            ? `(+${insertions ? insertions[1] : 0},-${deletions ? deletions[1] : 0})`
            : null
      } else {
        info.stats = null
      }
    } catch (e) {}
  }

  return {
    refreshStatus,
    getInfo: () => info,
  }
}
