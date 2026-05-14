import { useSettingsStore } from '@renderer/store/use-settings-store'

export const sendDesktopNotification = async (
  title: string,
  body: string
): Promise<boolean> => {
  if (import.meta.env.VITE_ENABLE_DESKTOP_NOTIFICATIONS === 'false') {
    return false
  }

  if (!useSettingsStore.getState().settings.notifications.desktop) {
    return false
  }

  if (window.desktopAPI?.notify) {
    return window.desktopAPI.notify({ title, body })
  }

  if (!('Notification' in window)) {
    return false
  }

  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }

  if (Notification.permission !== 'granted') {
    return false
  }

  new Notification(title, { body })
  return true
}

export const openExternalLink = async (url: string): Promise<void> => {
  if (window.desktopAPI?.openExternal) {
    await window.desktopAPI.openExternal(url)
    return
  }

  window.open(url, '_blank', 'noopener,noreferrer')
}
