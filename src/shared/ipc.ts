import type { AppUpdateState } from '@shared/types/updates'

export interface DesktopNotificationPayload {
  title: string
  body: string
  silent?: boolean
}

export interface DesktopFetchOptions {
  headers?: Record<string, string>
  timeoutMs?: number
}

export interface DesktopAPI {
  notify: (payload: DesktopNotificationPayload) => Promise<boolean>
  openExternal: (url: string) => Promise<void>
  fetchJson: <T>(url: string, options?: DesktopFetchOptions) => Promise<T>
  fetchText: (url: string, options?: DesktopFetchOptions) => Promise<string>
  getUpdateState: () => Promise<AppUpdateState>
  checkForUpdates: () => Promise<AppUpdateState>
  quitAndInstallUpdate: () => Promise<void>
  onUpdateStateChanged: (listener: (state: AppUpdateState) => void) => () => void
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI
  }
}

export {}
