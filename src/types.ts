export type EmoteState =
  | 'hi'
  | 'idle'
  | 'think'
  | 'talk'
  | 'read'
  | 'write'
  | 'tool'
  | 'success'
  | 'failure'
  | 'compact'

export interface Config {
  enabled: boolean
  size: number
  readingSpeed: number
  character: string
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
