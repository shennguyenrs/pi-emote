import type { ProgressBarTheme, WidgetColor, WidgetTheme } from './types.js'

export function resolveProgressColor(
  percent: number,
  cacheHitRate: number,
  pb: ProgressBarTheme,
): WidgetColor {
  if (cacheHitRate > 0 && cacheHitRate < 50) return pb['cache-miss'] ?? 'error'
  if (percent >= 75) return pb['almost-full'] ?? 'warning'
  if (cacheHitRate >= 50) return pb['cache-hit'] ?? 'success'
  return pb.default ?? 'text'
}

export const DEFAULT_WIDGET_THEME: WidgetTheme = {
  'model-name': 'thinking-level-color',
  'progress-bar': {
    default: 'text',
    'cache-hit': 'success',
    'cache-miss': 'error',
    'almost-full': 'warning',
  },
  'token-info': 'dim',
  'working-directory': 'warning',
  border: 'thinking-level-color',
  'vertical-separator': 'thinking-level-color',
}

export function sanitizeWidgetTheme(theme: unknown): WidgetTheme {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
    return { ...DEFAULT_WIDGET_THEME }
  }

  const t = theme as Record<string, any>
  return {
    ...DEFAULT_WIDGET_THEME,
    ...t,
    'progress-bar': {
      ...DEFAULT_WIDGET_THEME['progress-bar'],
      ...(t['progress-bar'] || {}),
    },
  }
}
