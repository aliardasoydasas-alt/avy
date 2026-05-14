import type { LiveNotificationSettings } from '@shared/types/user'

const NTFY_BASE_URL = 'https://ntfy.sh'

export const normalizeNtfyTopic = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)

export const buildNtfySubscribeLink = (topic: string, deviceLabel?: string): string => {
  const normalizedTopic = normalizeNtfyTopic(topic)
  const label = encodeURIComponent(deviceLabel?.trim() || 'AVY Canli Bildirim')
  return `ntfy://ntfy.sh/${normalizedTopic}?display=${label}`
}

interface SendLiveMobileNotificationInput {
  title: string
  body: string
  settings: LiveNotificationSettings
  priority?: 'default' | 'high' | 'urgent'
  tags?: string[]
}

export const sendLiveMobileNotification = async ({
  title,
  body,
  settings,
  priority = 'high',
  tags = ['chart_with_upwards_trend']
}: SendLiveMobileNotificationInput): Promise<boolean> => {
  if (!settings.enabled || !settings.mobileEnabled) {
    return false
  }

  const topic = normalizeNtfyTopic(settings.ntfyTopic)

  if (!topic) {
    return false
  }

  const response = await fetch(`${NTFY_BASE_URL}/${topic}`, {
    method: 'POST',
    headers: {
      Title: title,
      Priority: priority,
      Tags: tags.join(','),
      'Content-Type': 'text/plain; charset=utf-8'
    },
    body
  })

  if (!response.ok) {
    throw new Error(`Telefon bildirimi gönderilemedi (${response.status}).`)
  }

  return true
}

export const sendLiveNotificationTest = async (
  settings: LiveNotificationSettings
): Promise<boolean> =>
  sendLiveMobileNotification({
    title: 'AVY canlı bildirim hattı hazır',
    body: 'Telefon kanalın aktif. Bundan sonra portföy hedefi ve varlık hareketleri telefonuna düşebilir.',
    settings,
    priority: 'default',
    tags: ['signal_strength', 'iphone']
  })
