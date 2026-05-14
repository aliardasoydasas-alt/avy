export type AppUpdatePhase =
  | 'disabled'
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface AppUpdateState {
  enabled: boolean
  phase: AppUpdatePhase
  currentVersion: string
  availableVersion?: string
  downloadedVersion?: string
  progressPercent?: number
  bytesPerSecond?: number
  checkedAt?: string
  message: string
}
