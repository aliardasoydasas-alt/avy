const GIF_MARKER = /\[\[AVY_GIF:(.+?)\]\]/g
const IMAGE_MARKER = /\[\[AVY_IMAGE:(.+?)\]\]/g

export interface SocialRichContent {
  text: string
  gifUrl?: string
  imageUrl?: string
}

const normalizeMediaUrl = (value?: string, allowGifOnly = false): string | undefined => {
  const trimmed = value?.trim()

  if (!trimmed) {
    return undefined
  }

  if (allowGifOnly) {
    if (
      trimmed.startsWith('data:image/gif') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('http://')
    ) {
      return trimmed
    }

    return undefined
  }

  if (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://')
  ) {
    return trimmed
  }

  return undefined
}

export const composeSocialRichBody = (
  text: string,
  gifUrl?: string,
  imageUrl?: string
): string => {
  const normalizedText = text.trim()
  const normalizedGif = normalizeMediaUrl(gifUrl, true)
  const normalizedImage = normalizeMediaUrl(imageUrl)
  const segments = [normalizedText]

  if (normalizedGif) {
    segments.push(`[[AVY_GIF:${normalizedGif}]]`)
  }

  if (normalizedImage) {
    segments.push(`[[AVY_IMAGE:${normalizedImage}]]`)
  }

  return segments.filter(Boolean).join('\n').trim()
}

export const parseSocialRichBody = (body: string): SocialRichContent => {
  const gifMatches = [...body.matchAll(GIF_MARKER)]
  const imageMatches = [...body.matchAll(IMAGE_MARKER)]
  const lastGif = gifMatches.at(-1)?.[1]
  const lastImage = imageMatches.at(-1)?.[1]
  const text = body.replace(GIF_MARKER, '').replace(IMAGE_MARKER, '').trim()

  return {
    text,
    gifUrl: normalizeMediaUrl(lastGif, true),
    imageUrl: normalizeMediaUrl(lastImage)
  }
}
