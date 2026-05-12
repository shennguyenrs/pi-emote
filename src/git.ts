import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export interface GitInfo {
  branch: string | null
  stats: string | null
}

export interface GitTracker {
  refreshStatus: (ctx: any, branchOverride?: string | null) => Promise<void>
  setBranch: (branch: string | null) => void
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
      info.stats = statsResult?.stdout.trim() || null
    } catch (e) {}
  }

  return {
    refreshStatus,
    setBranch: (branch) => {
      info.branch = branch
    },
    getInfo: () => info,
  }
}
