import { ArrowUpCircle, Download, RefreshCw } from 'lucide-react'
import { StatusPill } from '@renderer/components/status-pill'
import type { AppUpdateState } from '@shared/types/updates'

interface UpdateMenuSectionProps {
  state: AppUpdateState
  isBusy: boolean
  onCheck: () => void
  onInstall: () => void
}

const phaseToneMap: Record<AppUpdateState['phase'], 'positive' | 'negative' | 'neutral' | 'info'> = {
  disabled: 'neutral',
  idle: 'positive',
  checking: 'info',
  available: 'info',
  downloading: 'info',
  downloaded: 'positive',
  error: 'negative'
}

const phaseLabelMap: Record<AppUpdateState['phase'], string> = {
  disabled: 'Kapali',
  idle: 'Guncel',
  checking: 'Kontrol',
  available: 'Bulundu',
  downloading: 'Indiriliyor',
  downloaded: 'Hazir',
  error: 'Hata'
}

export const UpdateMenuSection = ({
  state,
  isBusy,
  onCheck,
  onInstall
}: UpdateMenuSectionProps) => (
  <div className="toolbar-update-card">
    <div className="toolbar-update-card__header">
      <div>
        <strong>Uygulama guncellemesi</strong>
        <p>Surum v{state.currentVersion}</p>
      </div>
      <StatusPill label={phaseLabelMap[state.phase]} tone={phaseToneMap[state.phase]} />
    </div>

    <p className="toolbar-update-card__message">{state.message}</p>

    {state.phase === 'downloading' || state.phase === 'downloaded' ? (
      <div className="toolbar-update-progress">
        <div
          className="toolbar-update-progress__bar"
          style={{ width: `${Math.max(0, Math.min(100, state.progressPercent ?? 0))}%` }}
        />
      </div>
    ) : null}

    <div className="toolbar-update-actions">
      <button
        type="button"
        className="toolbar-menu-item"
        onClick={onCheck}
        disabled={isBusy || !state.enabled}
      >
        <RefreshCw size={16} />
        <span>Guncellemeleri denetle</span>
      </button>

      {state.phase === 'downloaded' ? (
        <button type="button" className="toolbar-menu-item" onClick={onInstall} disabled={isBusy}>
          <ArrowUpCircle size={16} />
          <span>Simdi guncelle</span>
        </button>
      ) : state.phase === 'downloading' ? (
        <div className="toolbar-update-inline">
          <Download size={16} />
          <span>%{Math.round(state.progressPercent ?? 0)} indirildi</span>
        </div>
      ) : null}
    </div>
  </div>
)
