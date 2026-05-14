import { contextBridge, ipcRenderer } from 'electron'
import type {
  DesktopAPI,
  DesktopFetchOptions,
  DesktopNotificationPayload
} from '@shared/ipc'

const desktopAPI: DesktopAPI = {
  notify: (payload: DesktopNotificationPayload) =>
    ipcRenderer.invoke('desktop:notify', payload),
  openExternal: (url: string) => ipcRenderer.invoke('desktop:openExternal', url),
  fetchJson: <T>(url: string, options?: DesktopFetchOptions) =>
    ipcRenderer.invoke('desktop:fetchJson', url, options) as Promise<T>,
  fetchText: (url: string, options?: DesktopFetchOptions) =>
    ipcRenderer.invoke('desktop:fetchText', url, options),
  getUpdateState: () => ipcRenderer.invoke('desktop:getUpdateState'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:checkForUpdates'),
  quitAndInstallUpdate: () => ipcRenderer.invoke('desktop:quitAndInstallUpdate'),
  onUpdateStateChanged: (listener) => {
    const wrapped = (_event: Electron.IpcRendererEvent, state: Parameters<typeof listener>[0]) => {
      listener(state)
    }
    ipcRenderer.on('desktop:update-state-changed', wrapped)
    return () => ipcRenderer.removeListener('desktop:update-state-changed', wrapped)
  }
}

contextBridge.exposeInMainWorld('desktopAPI', desktopAPI)
