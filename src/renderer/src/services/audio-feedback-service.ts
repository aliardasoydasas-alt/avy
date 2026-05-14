import { useSettingsStore } from '@renderer/store/use-settings-store'

export type AudioFeedbackKind = 'ui' | 'message' | 'message_sent' | 'poke' | 'notification'

let audioContext: AudioContext | null = null

const getAudioContext = (): AudioContext | null => {
  if (typeof window === 'undefined') {
    return null
  }

  const Context =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

  if (!Context) {
    return null
  }

  if (!audioContext) {
    audioContext = new Context()
  }

  return audioContext
}

const scheduleTone = (
  context: AudioContext,
  startAt: number,
  duration: number,
  frequency: number,
  volume: number,
  type: OscillatorType = 'sine'
): void => {
  const oscillator = context.createOscillator()
  const gain = context.createGain()

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startAt)

  gain.gain.setValueAtTime(0.0001, startAt)
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), startAt + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)

  oscillator.connect(gain)
  gain.connect(context.destination)

  oscillator.start(startAt)
  oscillator.stop(startAt + duration + 0.05)
}

const isCategoryEnabled = (kind: AudioFeedbackKind): boolean => {
  const settings = useSettingsStore.getState().settings.sound

  if (!settings.enabled) {
    return false
  }

  if (kind === 'ui') {
    return settings.ui
  }

  if (kind === 'message' || kind === 'message_sent' || kind === 'poke') {
    return settings.messages
  }

  return settings.notifications
}

const getVolume = (): number => {
  const volume = useSettingsStore.getState().settings.sound.volume
  return Math.max(0.01, Math.min(0.16, volume / 1000))
}

export const playAudioFeedback = async (kind: AudioFeedbackKind): Promise<void> => {
  if (!isCategoryEnabled(kind)) {
    return
  }

  try {
    const context = getAudioContext()

    if (!context) {
      return
    }

    if (context.state === 'suspended') {
      await context.resume()
    }

    const volume = getVolume()
    const start = context.currentTime + 0.01

    switch (kind) {
      case 'ui':
        scheduleTone(context, start, 0.05, 520, volume * 0.5, 'triangle')
        return
      case 'message_sent':
        scheduleTone(context, start, 0.08, 640, volume * 0.65)
        scheduleTone(context, start + 0.08, 0.09, 880, volume * 0.55)
        return
      case 'message':
        scheduleTone(context, start, 0.1, 720, volume * 0.75)
        scheduleTone(context, start + 0.1, 0.1, 940, volume * 0.55)
        return
      case 'poke':
        scheduleTone(context, start, 0.08, 780, volume * 0.7, 'triangle')
        scheduleTone(context, start + 0.08, 0.14, 1040, volume * 0.6, 'triangle')
        return
      case 'notification':
        scheduleTone(context, start, 0.09, 560, volume * 0.55)
        scheduleTone(context, start + 0.09, 0.12, 760, volume * 0.5)
        return
    }
  } catch {
    // Audio feedback should never break the UI flow.
  }
}
