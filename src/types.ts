export const EMOTE_STATES = [
  'hi',
  'idle',
  'think',
  'talk',
  'read',
  'write',
  'tool',
  'success',
  'failure',
  'compact',
] as const

export type EmoteState = (typeof EMOTE_STATES)[number]

export type ThemeColor =
  | 'accent'
  | 'border'
  | 'borderAccent'
  | 'borderMuted'
  | 'success'
  | 'error'
  | 'warning'
  | 'muted'
  | 'dim'
  | 'text'
  | 'thinkingText'
  | 'userMessageText'
  | 'customMessageText'
  | 'customMessageLabel'
  | 'toolTitle'
  | 'toolOutput'
  | 'mdHeading'
  | 'mdLink'
  | 'mdLinkUrl'
  | 'mdCode'
  | 'mdCodeBlock'
  | 'mdCodeBlockBorder'
  | 'mdQuote'
  | 'mdQuoteBorder'
  | 'mdHr'
  | 'mdListBullet'
  | 'toolDiffAdded'
  | 'toolDiffRemoved'
  | 'toolDiffContext'
  | 'syntaxComment'
  | 'syntaxKeyword'
  | 'syntaxFunction'
  | 'syntaxVariable'
  | 'syntaxString'
  | 'syntaxNumber'
  | 'syntaxType'
  | 'syntaxOperator'
  | 'syntaxPunctuation'
  | 'thinkingOff'
  | 'thinkingMinimal'
  | 'thinkingLow'
  | 'thinkingMedium'
  | 'thinkingHigh'
  | 'thinkingXhigh'
  | 'thinkingMax'
  | 'bashMode'

export type WidgetColor = ThemeColor | 'thinking-level-color'

export interface ProgressBarTheme {
  default?: WidgetColor
  'cache-hit'?: WidgetColor
  'cache-miss'?: WidgetColor
  'almost-full'?: WidgetColor
}

export interface WidgetTheme {
  'model-name'?: WidgetColor
  'progress-bar'?: ProgressBarTheme
  'token-info'?: WidgetColor
  'working-directory'?: WidgetColor
  border?: WidgetColor
  'vertical-separator'?: WidgetColor
}

export interface TerminalMapping {
  match: string
  render: 'kitty' | 'kitty-unicode' | 'iterm2' | 'ascii' | 'auto'
}

export interface ResolvedRenderer {
  protocol: 'kitty' | 'kitty-unicode' | 'iterm2' | 'ascii'
  multiplexer: 'tmux' | 'screen' | 'zellij' | null
  warning: string | null
  warningLevel: 'warning' | 'info'
}

export interface EmoteMapping {
  model?: string
  'thinking-level'?: string
  'emote-set': string
}

export interface Config {
  enabled: boolean
  size: number
  character: string
  modelCharacters?: Record<string, string>
  emotes?: EmoteMapping[]
  hideBelow: number
  terminals: TerminalMapping[]
  holdDuration: { hi: number; success: number; failure: number }
  blinkInterval: [number, number]
  talkTickMs: number
  cycleMs: number
  idle?: { default?: string; blink?: string }
  talk?: { weights?: Record<string, number> }
  theme?: WidgetTheme
}

export interface EmotesConfig {
  idle?: { default?: string; blink?: string }
  talk?: { weights?: Record<string, number> }
}

export interface SessionStats {
  totalInput: number
  totalOutput: number
  totalCost: number
}

export interface FrameSet {
  stateDir: string
  files: string[]
  base64Cache: Map<string, string>
}

export interface EmoteStateController {
  transitionTo: (state: EmoteState) => void
  onTalkToken: (text: string) => void
  endTalk: () => void
  clearAllTimers: () => void
  setWidgetActive: (active: boolean) => void
  getCurrentState: () => EmoteState
  setHoldNextState: (state: EmoteState) => void
  setRenderer: (renderer: any) => void
}
