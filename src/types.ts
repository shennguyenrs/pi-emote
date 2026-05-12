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

export interface Config {
  enabled: boolean
  size: number
  readingSpeed: number
  character: string
  modelCharacters?: Record<string, string>
  hideBelow: number
  holdDuration: { hi: number; success: number; failure: number }
  blinkInterval: [number, number]
  talkTickMs: number
  cycleMs: number
  idle?: { default?: string; blink?: string }
  talk?: { weights?: Record<string, number> }
}

export interface EmotesConfig {
  idle?: { default?: string; blink?: string }
  talk?: { weights?: Record<string, number> }
}

export interface FrameSet {
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
