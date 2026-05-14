import { app, BrowserWindow, Notification } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import electronUpdater, { type AppUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater'
import type { AppUpdateState } from '@shared/types/updates'

const UPDATE_EVENT_CHANNEL = 'desktop:update-state-changed'

const initialState = (): AppUpdateState => ({
  enabled: false,
  phase: 'disabled',
  currentVersion: app.getVersion(),
  message: 'Guncelleme kanali bu kurulum icin bagli degil.'
})

class AppUpdateService {
  private readonly updater: AppUpdater
  private readonly state: AppUpdateState = initialState()
  private readonly windows = new Set<BrowserWindow>()
  private initialized = false
  private autoCheckStarted = false

  constructor() {
    const { autoUpdater } = electronUpdater
    this.updater = autoUpdater
  }

  attachWindow(window: BrowserWindow): void {
    this.windows.add(window)
    window.on('closed', () => {
      this.windows.delete(window)
    })
    this.broadcastState()
  }

  init(): void {
    if (this.initialized) {
      return
    }

    this.initialized = true

    if (!app.isPackaged) {
      this.setState({
        enabled: false,
        phase: 'disabled',
        currentVersion: app.getVersion(),
        message: 'Otomatik guncelleme yalnizca kurulu surumde aktif olur.'
      })
      return
    }

    const updateConfigPath = join(process.resourcesPath, 'app-update.yml')

    if (!existsSync(updateConfigPath)) {
      this.setState({
        enabled: false,
        phase: 'disabled',
        currentVersion: app.getVersion(),
        message: 'Guncelleme kanali bagli degil. Yeni build yayin URL ile uretilmeli.'
      })
      return
    }

    this.updater.autoDownload = true
    this.updater.autoInstallOnAppQuit = false

    this.updater.on('checking-for-update', () => {
      this.setState({
        enabled: true,
        phase: 'checking',
        currentVersion: app.getVersion(),
        checkedAt: new Date().toISOString(),
        message: 'Yeni surum denetleniyor.'
      })
    })

    this.updater.on('update-available', (info: UpdateInfo) => {
      this.setState({
        enabled: true,
        phase: 'available',
        currentVersion: app.getVersion(),
        availableVersion: info.version,
        checkedAt: new Date().toISOString(),
        message: `Yeni surum bulundu: v${info.version}. Indirme basladi.`
      })
    })

    this.updater.on('update-not-available', () => {
      this.setState({
        enabled: true,
        phase: 'idle',
        currentVersion: app.getVersion(),
        checkedAt: new Date().toISOString(),
        message: 'AVY su an guncel.'
      })
    })

    this.updater.on('download-progress', (progress: ProgressInfo) => {
      this.setState({
        enabled: true,
        phase: 'downloading',
        currentVersion: app.getVersion(),
        availableVersion: this.state.availableVersion,
        progressPercent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        checkedAt: this.state.checkedAt ?? new Date().toISOString(),
        message: `Guncelleme indiriliyor: %${Math.round(progress.percent)}`
      })
    })

    this.updater.on('update-downloaded', (info: UpdateInfo) => {
      this.setState({
        enabled: true,
        phase: 'downloaded',
        currentVersion: app.getVersion(),
        availableVersion: info.version,
        downloadedVersion: info.version,
        progressPercent: 100,
        checkedAt: new Date().toISOString(),
        message: `v${info.version} indirildi. Yeniden baslatip guncelleyebilirsin.`
      })

      if (Notification.isSupported()) {
        new Notification({
          title: 'AVY guncellemesi hazir',
          body: `v${info.version} indirildi. Uygulamayi yeniden baslatip guncelleyebilirsin.`,
          silent: false
        }).show()
      }
    })

    this.updater.on('error', (error: Error) => {
      this.setState({
        enabled: true,
        phase: 'error',
        currentVersion: app.getVersion(),
        availableVersion: this.state.availableVersion,
        progressPercent: undefined,
        checkedAt: new Date().toISOString(),
        message: error.message || 'Guncelleme denetlenirken bir hata olustu.'
      })
    })

    this.setState({
      enabled: true,
      phase: 'idle',
      currentVersion: app.getVersion(),
      message: 'Guncelleme servisi hazir.'
    })
  }

  getState(): AppUpdateState {
    return { ...this.state }
  }

  async checkForUpdates(): Promise<AppUpdateState> {
    this.init()

    if (!this.state.enabled) {
      return this.getState()
    }

    await this.updater.checkForUpdates()
    return this.getState()
  }

  scheduleAutoCheck(): void {
    if (this.autoCheckStarted) {
      return
    }

    this.autoCheckStarted = true

    if (!this.state.enabled) {
      return
    }

    setTimeout(() => {
      void this.checkForUpdates().catch(() => undefined)
    }, 8_000)
  }

  quitAndInstall(): void {
    if (this.state.phase !== 'downloaded') {
      return
    }

    this.updater.quitAndInstall(false, true)
  }

  private setState(nextState: AppUpdateState): void {
    Object.assign(this.state, nextState)
    this.broadcastState()
  }

  private broadcastState(): void {
    const snapshot = this.getState()

    for (const window of this.windows) {
      if (!window.isDestroyed()) {
        window.webContents.send(UPDATE_EVENT_CHANNEL, snapshot)
      }
    }
  }
}

export const appUpdateService = new AppUpdateService()
