import { playAudioFeedback } from '@renderer/services/audio-feedback-service'

type SocialSoundKind = 'message' | 'poke'

export const playSocialSound = async (kind: SocialSoundKind): Promise<void> => {
  await playAudioFeedback(kind)
}
