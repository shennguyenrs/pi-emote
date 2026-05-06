import type { EmoteState, Config, EmotesConfig, FrameSet } from './types'
import {
  getRandomFrame,
  getFrame,
  getTalkFrame,
  getTalkCloseFrame,
  getCycleFrame,
} from './assets'
import { randomInRange } from './utils'

export function createEmoteState(
  config: Config,
  getEmotesConfig: () => EmotesConfig,
  getFrameMap: () => Map<string, FrameSet>,
  renderer: { showImage: (base64: string, force?: boolean) => void },
) {
  let currentState: EmoteState = 'idle'
  let widgetActive = false

  // Timers
  let holdTimer: ReturnType<typeof setTimeout> | null = null
  let blinkTimer: ReturnType<typeof setTimeout> | null = null
  let talkTimer: ReturnType<typeof setInterval> | null = null
  let cycleTimer: ReturnType<typeof setInterval> | null = null
  let talkGapTimer: ReturnType<typeof setTimeout> | null = null
  let talkDurationTimer: ReturnType<typeof setTimeout> | null = null

  let cycleIndex = 0
  let cycleDirection = 1
  let holdNextState: EmoteState = 'idle'

  // Talk state
  let talkWordCount = 0
  let talkStartTime = 0
  let lastTokenTime = 0
  let talkMouthClosed = false

  function clearAllTimers() {
    ;[holdTimer, blinkTimer, talkGapTimer, talkDurationTimer].forEach((t) => {
      if (t) clearTimeout(t)
    })
    ;[talkTimer, cycleTimer].forEach((t) => {
      if (t) clearInterval(t)
    })
    holdTimer = blinkTimer = talkGapTimer = talkDurationTimer = null
    talkTimer = cycleTimer = null
  }

  function clearStateTimers() {
    ;[holdTimer, talkGapTimer, talkDurationTimer].forEach((t) => {
      if (t) clearTimeout(t)
    })
    ;[talkTimer, cycleTimer].forEach((t) => {
      if (t) clearInterval(t)
    })
    holdTimer = talkGapTimer = talkDurationTimer = null
    talkTimer = cycleTimer = null
  }

  function transitionTo(state: EmoteState) {
    if (!widgetActive) return
    clearStateTimers()
    if (currentState === 'idle' && blinkTimer) {
      clearTimeout(blinkTimer)
      blinkTimer = null
    }
    currentState = state

    switch (state) {
      case 'hi':
        enterHi()
        break
      case 'idle':
        enterIdle()
        break
      case 'think':
      case 'read':
      case 'write':
      case 'tool':
        enterCycle(state)
        break
      case 'talk':
        enterTalk()
        break
      case 'success':
      case 'failure':
        enterHold(
          state,
          state === 'success'
            ? config.holdDuration.success
            : config.holdDuration.failure,
          holdNextState,
        )
        holdNextState = 'idle'
        break
      case 'compact':
        enterCompact()
        break
    }
  }

  function enterHi() {
    const frame = getRandomFrame(getFrameMap(), 'hi')
    if (frame) renderer.showImage(frame)
    holdTimer = setTimeout(() => transitionTo('idle'), config.holdDuration.hi)
  }

  function enterIdle() {
    const ec = getEmotesConfig()
    const defaultFile = ec.idle?.default ?? config.idle?.default ?? 'idle.png'
    const frame = getFrame(getFrameMap(), 'idle', defaultFile)
    if (frame) renderer.showImage(frame)
    scheduleBlink()
  }

  function scheduleBlink() {
    if (blinkTimer) clearTimeout(blinkTimer)
    const delay = randomInRange(
      config.blinkInterval[0],
      config.blinkInterval[1],
    )
    blinkTimer = setTimeout(() => {
      if (currentState !== 'idle') return
      doBlink()
    }, delay)
  }

  function doBlink() {
    const ec = getEmotesConfig()
    const blinkFile = ec.idle?.blink ?? config.idle?.blink ?? 'idle_blink.png'
    const blinkFrame = getFrame(getFrameMap(), 'idle', blinkFile)
    if (!blinkFrame) {
      scheduleBlink()
      return
    }

    renderer.showImage(blinkFrame)

    const doubleBlink = Math.random() < 0.15
    const blinkDuration = 150

    setTimeout(() => {
      if (currentState !== 'idle') return
      const defaultFile = ec.idle?.default ?? config.idle?.default ?? 'idle.png'
      const defaultFrame = getFrame(getFrameMap(), 'idle', defaultFile)
      if (defaultFrame) renderer.showImage(defaultFrame, true)

      if (doubleBlink) {
        setTimeout(() => {
          if (currentState !== 'idle') return
          renderer.showImage(blinkFrame, true)
          setTimeout(() => {
            if (currentState !== 'idle') return
            if (defaultFrame) renderer.showImage(defaultFrame, true)
            scheduleBlink()
          }, blinkDuration)
        }, 100)
      } else {
        scheduleBlink()
      }
    }, blinkDuration)
  }

  function enterTalk() {
    talkWordCount = 0
    talkStartTime = Date.now()
    lastTokenTime = Date.now()
    talkMouthClosed = false

    const frame = getTalkFrame(getFrameMap(), config, getEmotesConfig())
    if (frame) renderer.showImage(frame)

    talkTimer = setInterval(() => {
      if (currentState !== 'talk') return
      if (talkMouthClosed) {
        const closeFrame = getTalkCloseFrame(getFrameMap())
        if (closeFrame) renderer.showImage(closeFrame)
      } else {
        const f = getTalkFrame(getFrameMap(), config, getEmotesConfig())
        if (f) renderer.showImage(f)
      }
    }, config.talkTickMs)
  }

  function onTalkToken(text: string) {
    if (currentState !== 'talk') return

    const words = text.split(/\s+/).filter((w) => w.length > 0).length
    talkWordCount += words
    lastTokenTime = Date.now()

    if (talkMouthClosed) {
      talkMouthClosed = false
    }

    if (talkGapTimer) clearTimeout(talkGapTimer)
    talkGapTimer = setTimeout(() => {
      if (currentState !== 'talk') return
      talkMouthClosed = true
    }, 200)

    recalculateTalkDuration()
  }

  function recalculateTalkDuration() {
    if (talkDurationTimer) clearTimeout(talkDurationTimer)

    const targetDurationMs = (talkWordCount / config.readingSpeed) * 1000
    const elapsed = Date.now() - talkStartTime
    const remaining = Math.max(0, targetDurationMs - elapsed)

    talkDurationTimer = setTimeout(() => {
      if (currentState !== 'talk') return
      const timeSinceLastToken = Date.now() - lastTokenTime
      if (timeSinceLastToken > 200) {
        transitionTo('idle')
      } else {
        talkDurationTimer = setTimeout(() => {
          if (currentState === 'talk') transitionTo('idle')
        }, 200)
      }
    }, remaining)
  }

  function endTalk() {
    if (currentState !== 'talk') return
    const targetDurationMs = (talkWordCount / config.readingSpeed) * 1000
    const elapsed = Date.now() - talkStartTime
    if (elapsed >= targetDurationMs) {
      transitionTo('idle')
    }
  }

  function enterCycle(state: EmoteState) {
    cycleIndex = 0
    cycleDirection = 1
    const frame = getCycleFrame(getFrameMap(), state, cycleIndex)
    if (frame) renderer.showImage(frame)

    const frameSet = getFrameMap().get(state)
    if (!frameSet || frameSet.files.length <= 1) return

    cycleTimer = setInterval(() => {
      if (currentState !== state) return
      cycleIndex += cycleDirection
      if (cycleIndex >= frameSet.files.length - 1) cycleDirection = -1
      if (cycleIndex <= 0) cycleDirection = 1
      const f = getCycleFrame(getFrameMap(), state, cycleIndex)
      if (f) renderer.showImage(f)
    }, config.cycleMs)
  }

  function enterHold(
    state: EmoteState,
    duration: number,
    nextState: EmoteState = 'idle',
  ) {
    const frame = getRandomFrame(getFrameMap(), state)
    if (frame) renderer.showImage(frame)
    holdTimer = setTimeout(() => transitionTo(nextState), duration)
  }

  function enterCompact() {
    const frame = getRandomFrame(getFrameMap(), 'compact')
    if (frame) renderer.showImage(frame)
  }

  return {
    transitionTo,
    onTalkToken,
    endTalk,
    clearAllTimers,
    setWidgetActive: (active: boolean) => (widgetActive = active),
    getCurrentState: () => currentState,
    setHoldNextState: (state: EmoteState) => (holdNextState = state),
  }
}
