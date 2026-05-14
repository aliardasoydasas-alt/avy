import { useEffect } from 'react'
import { playAudioFeedback } from '@renderer/services/audio-feedback-service'

const CLICKABLE_SELECTORS = [
  'button',
  '[role="button"]',
  '.chip',
  '.tab-button',
  '.toolbar-icon-button',
  '.toolbar-profile-button',
  '.sidebar-home-button'
].join(', ')

export const AudioFeedbackBridge = () => {
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null

      if (!target) {
        return
      }

      const clickable = target.closest<HTMLElement>(CLICKABLE_SELECTORS)

      if (!clickable || clickable.dataset.audio === 'none' || clickable.matches('input, textarea, select')) {
        return
      }

      void playAudioFeedback('ui')
    }

    document.addEventListener('click', handleClick, true)

    return () => {
      document.removeEventListener('click', handleClick, true)
    }
  }, [])

  return null
}
