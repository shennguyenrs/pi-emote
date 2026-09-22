import { getCapabilities } from '@earendil-works/pi-tui'
import type { TerminalMapping, ResolvedRenderer } from './types'
import { checkTmuxPassthrough, detectOuterTerminal } from './tmux'

type Protocol = 'kitty' | 'kitty-unicode' | 'iterm2' | 'ascii'

const MULTIPLEXERS = new Set(['tmux', 'screen', 'zellij'])

/**
 * Detect the terminal or multiplexer name from environment variables.
 * Multiplexers are checked first — they set vars that leak through from
 * the outer terminal emulator.
 */
export function detectTerminalName(): string {
  const termProgram = (process.env.TERM_PROGRAM ?? '').toLowerCase()
  const term = (process.env.TERM ?? '').toLowerCase()

  // --- Multiplexers (checked first) ---
  if (process.env.ZELLIJ_SESSION_NAME || process.env.ZELLIJ) return 'zellij'
  if (process.env.TMUX || term.startsWith('tmux')) return 'tmux'
  if (term.startsWith('screen')) return 'screen'

  // --- Terminal emulators ---
  if (process.env.KITTY_WINDOW_ID || termProgram === 'kitty') return 'kitty'
  if (
    process.env.GHOSTTY_RESOURCES_DIR ||
    termProgram === 'ghostty' ||
    term.includes('ghostty')
  )
    return 'ghostty'
  if (process.env.WEZTERM_PANE || termProgram === 'wezterm') return 'wezterm'
  if (process.env.ITERM_SESSION_ID || termProgram === 'iterm.app')
    return 'iterm2'
  if (termProgram === 'vscode') return 'vscode'
  if (termProgram === 'alacritty') return 'alacritty'
  if (termProgram === 'warpterminal') return 'warpterminal'

  return 'unknown'
}

/**
 * Resolve which renderer to use.
 */
export function resolveRenderer(
  terminals: TerminalMapping[],
): ResolvedRenderer {
  const name = detectTerminalName()

  if (MULTIPLEXERS.has(name)) {
    const multiplexer = name as 'tmux' | 'screen' | 'zellij'
    const entry = terminals.find((e) => e.match === name)
    const render = entry?.render ?? 'auto'

    if (render !== 'auto') {
      return { protocol: render, multiplexer }
    }

    if (
      name === 'tmux' &&
      checkTmuxPassthrough() &&
      detectOuterTerminal() === 'kitty'
    ) {
      return { protocol: 'kitty-unicode', multiplexer }
    }

    return { protocol: 'ascii', multiplexer }
  }

  const entry = terminals.find((e) => e.match === name)
  if (entry) {
    const protocol =
      entry.render === 'auto'
        ? (getCapabilities().images ?? 'ascii')
        : entry.render
    return { protocol, multiplexer: null }
  }

  const fallback: Protocol = getCapabilities().images ?? 'ascii'
  return { protocol: fallback, multiplexer: null }
}
