import { app, BrowserWindow, ipcMain, Notification, shell } from 'electron'
import { join } from 'node:path'
import { appUpdateService } from './app-updater'
import type { DesktopFetchOptions, DesktopNotificationPayload } from '@shared/ipc'

const DEFAULT_FETCH_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9,tr;q=0.8',
  Accept: '*/*'
}

const fetchExternal = async (
  url: string,
  options?: DesktopFetchOptions
): Promise<Response> => {
  const targetUrl = new URL(url)

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    throw new Error(`Unsupported protocol: ${targetUrl.protocol}`)
  }

  const controller = new AbortController()
  const timeoutMs = options?.timeoutMs ?? 20000
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(targetUrl, {
      method: 'GET',
      headers: {
        ...DEFAULT_FETCH_HEADERS,
        ...options?.headers
      },
      signal: controller.signal
    })
  } finally {
    clearTimeout(timeout)
  }
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1680,
    height: 980,
    minWidth: 1280,
    minHeight: 760,
    autoHideMenuBar: true,
    backgroundColor: '#08111f',
    title: 'AVY',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const rendererUrl = process.env.ELECTRON_RENDERER_URL

  if (rendererUrl) {
    void mainWindow.loadURL(rendererUrl)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  appUpdateService.attachWindow(mainWindow)
}

app.whenReady().then(() => {
  appUpdateService.init()

  ipcMain.handle(
    'desktop:notify',
    async (_event, payload: DesktopNotificationPayload): Promise<boolean> => {
      if (!Notification.isSupported()) {
        return false
      }

      new Notification({
        title: payload.title,
        body: payload.body,
        silent: payload.silent ?? false
      }).show()

      return true
    }
  )

  ipcMain.handle('desktop:openExternal', async (_event, url: string) => {
    await shell.openExternal(url)
  })

  ipcMain.handle(
    'desktop:fetchJson',
    async (_event, url: string, options?: DesktopFetchOptions) => {
      const response = await fetchExternal(url, options)

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}: ${url}`)
      }

      return response.json()
    }
  )

  ipcMain.handle(
    'desktop:fetchText',
    async (_event, url: string, options?: DesktopFetchOptions) => {
      const response = await fetchExternal(url, options)

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}: ${url}`)
      }

      return response.text()
    }
  )

  ipcMain.handle('desktop:getUpdateState', async () => appUpdateService.getState())
  ipcMain.handle('desktop:checkForUpdates', async () => appUpdateService.checkForUpdates())
  ipcMain.handle('desktop:quitAndInstallUpdate', async () => {
    appUpdateService.quitAndInstall()
  })

  createWindow()
  appUpdateService.scheduleAutoCheck()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
