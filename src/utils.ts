import { visibleWidth, truncateToWidth } from '@mariozechner/pi-tui'

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

export function weightedRandomPick(weights: Record<string, number>): string {
  const entries = Object.entries(weights)
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let r = Math.random() * total
  for (const [file, weight] of entries) {
    r -= weight
    if (r <= 0) return file
  }
  return entries[entries.length - 1]![0]
}

export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 10_000) return `${Math.round(count / 1000)}k`
  if (count >= 1_000) return `${(count / 1000).toFixed(1)}k`
  return count.toString()
}

export function truncateLine(
  line: string,
  width: number,
  size: number,
): string {
  const infoWidth = width - size - 5 // 5 = " " (left pad) + " │ " (separator)
  if (visibleWidth(line) > infoWidth) {
    return truncateToWidth(line, infoWidth, '…')
  }
  return line
}
