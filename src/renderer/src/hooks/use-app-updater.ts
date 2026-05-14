import { useEffect, useState } from 'react'
import type { AppUpdateState } from '@shared/types/updates'

const fallbackState: AppUpdateState = {
  enabled: false,
  phase: 'disabled',
  currentVersion: '0.0.0',
  message: 'Guncelleme servisi bu ortamda hazir degil.'
}

export const useAppUpdater = () => {
  const [state, setState] = useState<AppUpdateState>(fallbackState)
  const [isActing, setIsActing] = useState(false)

  useEffect(() => {
    if (!window.desktopAPI) {
      return
    }

    let active = true

    void window.desktopAPI.getUpdateState().then((nextState) => {
      if (active) {
        setState(nextState)
      }
    })

    const unsubscribe = window.desktopAPI.onUpdateStateChanged((nextState) => {
      if (active) {
        setState(nextState)
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const checkForUpdates = async (): Promise<void> => {
    if (!window.desktopAPI) {
      return
    }

    setIsActing(true)

    try {
      const nextState = await window.desktopAPI.checkForUpdates()
      setState(nextState)
    } finally {
      setIsActing(false)
    }
  }

  const quitAndInstall = async (): Promise<void> => {
    if (!window.desktopAPI) {
      return
    }

    setIsActing(true)

    try {
      await window.desktopAPI.quitAndInstallUpdate()
    } finally {
      setIsActing(false)
    }
  }

  return {
    state,
    isActing,
    checkForUpdates,
    quitAndInstall
  }
}
