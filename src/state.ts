import type {
  EmoteState,
  Config,
  EmotesConfig,
  FrameSet,
  EmoteStateController,
} from './types'
import { randomInRange } from './utils'
import type { Renderer } from './renderer'

export function createEmoteState(
  config: Config,
  getEmotesConfig: () => EmotesConfig,
  renderer: Renderer,
): EmoteStateController {
  let currentState: EmoteState = 'idle'
  let widgetActive = false

  // Timers
  let holdTimer: ReturnType<typeof setTimeout> | null = null
  let blinkTimer: ReturnType<typeof setTimeout> | null = null
  let talkTimer: ReturnType<typeof setInterval> | null = null
  let cycleTimer: ReturnType<typeof setInterval> | null = null
  let talkGapTimer: ReturnType<typeof setTimeout> | null = null

  let cycleIndex = 0
  let cycleDirection = 1
  let holdNextState: EmoteState = 'idle'

  // Talk state
  let lastTokenTime = 0
  let talkMouthClosed = false

  function clearAllTimers() {
    const timeouts = [holdTimer, blinkTimer, talkGapTimer]
    timeouts.forEach((t) => {
      if (t) clearTimeout(t)
    })
    const intervals = [talkTimer, cycleTimer]
    intervals.forEach((t) => {
      if (t) clearInterval(t)
    })
    holdTimer = blinkTimer = talkGapTimer = null
    talkTimer = cycleTimer = null
  }

  function clearStateTimers() {
    const timeouts = [holdTimer, talkGapTimer]
    timeouts.forEach((t) => {
      if (t) clearTimeout(t)
    })
    const intervals = [talkTimer, cycleTimer]
    intervals.forEach((t) => {
      if (t) clearInterval(t)
    })
    holdTimer = talkGapTimer = null
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
    renderer.showRandomFrame('hi')
    holdTimer = setTimeout(() => transitionTo('idle'), config.holdDuration.hi)
  }

  function enterIdle() {
    const ec = getEmotesConfig()
    const defaultFile = ec.idle?.default ?? config.idle?.default ?? 'idle.png'
    renderer.showFrame('idle', defaultFile)
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
    if (!renderer.showFrame('idle', blinkFile, true)) {
      scheduleBlink()
      return
    }

    const doubleBlink = Math.random() < 0.15
    const blinkDuration = 200
    const defaultFile = ec.idle?.default ?? config.idle?.default ?? 'idle.png'

    setTimeout(() => {
      if (currentState !== 'idle') return
      renderer.showFrame('idle', defaultFile, true)

      if (doubleBlink) {
        setTimeout(() => {
          if (currentState !== 'idle') return
          renderer.showFrame('idle', blinkFile, true)
          setTimeout(() => {
            if (currentState !== 'idle') return
            renderer.showFrame('idle', defaultFile, true)
            scheduleBlink()
          }, blinkDuration)
        }, 100)
      } else {
        scheduleBlink()
      }
    }, blinkDuration)
  }

  function enterTalk() {
    lastTokenTime = Date.now()
    talkMouthClosed = false

    renderer.showTalkFrame(getEmotesConfig(), config.talk?.weights)

    talkTimer = setInterval(() => {
      if (currentState !== 'talk') return
      if (talkMouthClosed) {
        renderer.showTalkCloseFrame()
      } else {
        renderer.showTalkFrame(getEmotesConfig(), config.talk?.weights)
      }
    }, config.talkTickMs)
  }

  function onTalkToken(_text: string) {
    if (currentState !== 'talk') return

    lastTokenTime = Date.now()

    if (talkMouthClosed) {
      talkMouthClosed = false
    }

    if (talkGapTimer) clearTimeout(talkGapTimer)
    talkGapTimer = setTimeout(() => {
      if (currentState !== 'talk') return
      talkMouthClosed = true
    }, 200)
  }

  function endTalk() {
    if (currentState === 'talk') {
      transitionTo('idle')
    }
  }

  function enterCycle(state: EmoteState) {
    cycleIndex = 0
    cycleDirection = 1
    renderer.showCycleFrame(state, cycleIndex)

    const count = renderer.getCycleFrameCount(state)
    if (count <= 1) return

    cycleTimer = setInterval(() => {
      if (currentState !== state) return
      cycleIndex += cycleDirection
      if (cycleIndex >= count - 1) cycleDirection = -1
      if (cycleIndex <= 0) cycleDirection = 1
      renderer.showCycleFrame(state, cycleIndex)
    }, config.cycleMs)
  }

  function enterHold(
    state: EmoteState,
    duration: number,
    nextState: EmoteState = 'idle',
  ) {
    renderer.showRandomFrame(state)
    holdTimer = setTimeout(() => transitionTo(nextState), duration)
  }

  function enterCompact() {
    renderer.showRandomFrame('compact')
  }

  return {
    transitionTo,
    onTalkToken,
    endTalk,
    clearAllTimers,
    setWidgetActive: (active: boolean) => (widgetActive = active),
    getCurrentState: () => currentState,
    setHoldNextState: (state: EmoteState) => (holdNextState = state),
    setRenderer: (newRenderer: Renderer) => {
      renderer = newRenderer
    },
  }
}
