import { useEffect, useId, useState } from 'react'
import { Camera, Check, ImagePlus, Palette } from 'lucide-react'
import { Panel } from '@renderer/components/panel'
import { StatusPill } from '@renderer/components/status-pill'
import {
  BACKGROUND_PRESETS,
  WALLPAPER_PRESETS,
  getBackgroundPreviewStyle,
  getWallpaperPreviewStyle,
  isCustomWallpaperId
} from '@renderer/services/social-profile-showcase'
import { readImageFileAsDataUrl } from '@renderer/utils/image-upload'
import type { UserProfile, ProfileShowcaseSettings } from '@shared/types/social'
import type { UserSettings } from '@shared/types/user'

interface AccountSettingsPanelProps {
  profile: UserProfile
  settings: UserSettings
  showcase: ProfileShowcaseSettings
  onSaveProfile: (input: { username: string; displayName: string; bio: string }) => void
  onSaveAvatar: (avatarDataUrl?: string) => void
  onNotificationToggle: (key: keyof UserSettings['notifications'], enabled: boolean) => void
  onSoundPreferenceChange: (key: keyof UserSettings['sound'], value: boolean | number) => void
  onPortfolioVisibilityChange: (visibility: UserSettings['portfolioVisibility']) => void
  onSetWallpaper: (wallpaperId: string) => void
  onSetBackgroundPreset: (backgroundPresetId: string) => void
}

const buildInitials = (profile: UserProfile): string => {
  const seed = profile.displayName || profile.username || 'AVY'
  return seed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export const AccountSettingsPanel = ({
  profile,
  settings,
  showcase,
  onSaveProfile,
  onSaveAvatar,
  onNotificationToggle,
  onSoundPreferenceChange,
  onPortfolioVisibilityChange,
  onSetWallpaper,
  onSetBackgroundPreset
}: AccountSettingsPanelProps) => {
  const [draft, setDraft] = useState({
    username: profile.username,
    displayName: profile.displayName,
    bio: profile.bio
  })
  const [saveMessage, setSaveMessage] = useState('')
  const wallpaperInputId = useId()
  const customWallpaperActive = isCustomWallpaperId(showcase.wallpaperId)

  useEffect(() => {
    setDraft({
      username: profile.username,
      displayName: profile.displayName,
      bio: profile.bio
    })
  }, [profile.bio, profile.displayName, profile.username])

  const handleWallpaperUpload = async (file?: File | null): Promise<void> => {
    if (!file) {
      return
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file)
      onSetWallpaper(dataUrl)
      setSaveMessage('Özel wallpaper yüklendi.')
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : 'Wallpaper yüklenemedi.')
    }
  }

  return (
    <div className="list-stack">
      <Panel title="Ayarlar" subtitle="Hesap, profil ve deneyim tercihleri">
        <div className="profile-form-grid">
          <div className="list-stack">
            <label className="field-stack">
              <span>Kullanıcı adı</span>
              <input
                value={draft.username}
                onChange={(event) => setDraft((state) => ({ ...state, username: event.target.value }))}
                placeholder="örnek: avytrader"
              />
            </label>
            <label className="field-stack">
              <span>Görünen ad</span>
              <input
                value={draft.displayName}
                onChange={(event) => setDraft((state) => ({ ...state, displayName: event.target.value }))}
                placeholder="Ad Soyad"
              />
            </label>
            <label className="field-stack">
              <span>Biyografi</span>
              <textarea
                value={draft.bio}
                onChange={(event) => setDraft((state) => ({ ...state, bio: event.target.value }))}
                placeholder="Kendini kısa ve net şekilde tanıt"
                rows={5}
              />
            </label>
            <div className="inline-form">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  if (!draft.username.trim()) {
                    setSaveMessage('Profil için en az bir kullanıcı adı gir.')
                    return
                  }

                  onSaveProfile(draft)
                  setSaveMessage('Ayarlar kaydedildi.')
                }}
              >
                <Check size={16} />
                Kaydet
              </button>
              {saveMessage ? <span className="hero-card__helper">{saveMessage}</span> : null}
            </div>
          </div>

          <div className="list-stack">
            <div className="profile-avatar profile-avatar--editor">
              {profile.avatarDataUrl ? (
                <img src={profile.avatarDataUrl} alt="Profil resmi" />
              ) : (
                <strong>{buildInitials(profile)}</strong>
              )}
            </div>

            <label className="secondary-button profile-upload-button">
              <Camera size={16} />
              Profil resmi yükle
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0]

                  if (!file) {
                    return
                  }

                  const reader = new FileReader()
                  reader.onload = () => {
                    if (typeof reader.result === 'string') {
                      onSaveAvatar(reader.result)
                      setSaveMessage('Profil resmi güncellendi.')
                    }
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </label>
            <button type="button" className="text-button" onClick={() => onSaveAvatar(undefined)}>
              Profil resmini temizle
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="Profil görünümü" subtitle="Wallpaper ve renkli arka plan seç">
        <div className="list-stack">
          <div className="inline-form">
            <StatusPill label="Canlı profil vitrini" tone="info" />
            <StatusPill label="Herkese açık görünüm" tone="positive" />
          </div>

          <div className="social-showcase-settings social-showcase-settings--single">
            <div className="list-stack">
              <div className="mini-list__label">
                <Palette size={16} />
                <strong>Wallpaper</strong>
              </div>
              <div className="inline-form">
                <label htmlFor={wallpaperInputId} className="secondary-button social-upload-button">
                  <ImagePlus size={16} />
                  Bilgisayardan yükle
                </label>
                <input
                  id={wallpaperInputId}
                  type="file"
                  accept="image/*"
                  className="visually-hidden"
                  onChange={(event) => {
                    void handleWallpaperUpload(event.target.files?.[0] ?? null)
                    event.currentTarget.value = ''
                  }}
                />
                {customWallpaperActive ? (
                  <StatusPill label="Özel wallpaper aktif" tone="info" />
                ) : null}
              </div>
              <div className="social-showcase-grid">
                {customWallpaperActive ? (
                  <button
                    key="custom-wallpaper"
                    type="button"
                    className="social-showcase-tile social-showcase-tile--active"
                    onClick={() => onSetWallpaper(showcase.wallpaperId)}
                  >
                    <span
                      className="social-showcase-tile__preview"
                      style={getWallpaperPreviewStyle(showcase.wallpaperId)}
                    />
                    <strong>Özel wallpaper</strong>
                    <p>Bilgisayarından yüklediğin görsel kullanılıyor.</p>
                  </button>
                ) : null}
                {WALLPAPER_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={
                      showcase.wallpaperId === preset.id
                        ? 'social-showcase-tile social-showcase-tile--active'
                        : 'social-showcase-tile'
                    }
                    onClick={() => onSetWallpaper(preset.id)}
                  >
                    <span
                      className="social-showcase-tile__preview"
                      style={getWallpaperPreviewStyle(preset.id)}
                    />
                    <strong>{preset.title}</strong>
                    <p>{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="list-stack">
              <div className="mini-list__label">
                <Palette size={16} />
                <strong>Renkli arka plan</strong>
              </div>
              <div className="social-showcase-grid">
                {BACKGROUND_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={
                      showcase.backgroundPresetId === preset.id
                        ? 'social-showcase-tile social-showcase-tile--active'
                        : 'social-showcase-tile'
                    }
                    onClick={() => onSetBackgroundPreset(preset.id)}
                  >
                    <span
                      className="social-showcase-tile__preview social-showcase-tile__preview--animated"
                      style={getBackgroundPreviewStyle(preset.id)}
                    />
                    <strong>{preset.title}</strong>
                    <p>{preset.description}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="AVY AI" subtitle="Tüm kullanıcılar için ortak AI altyapısı">
        <div className="list-stack">
          <div className="inline-form">
            <StatusPill label="Kullanıcı anahtarı gerektirmez" tone="positive" />
            <StatusPill label="Ortak bulut AI" tone="info" />
          </div>
          <p className="hero-card__helper">
            Bu sürümde AI sohbet kişiden kişiye ayar istemez. AVY AI ortak sunucu katmanı
            üzerinden çalışır; uygulamayı indiren herkes aynı hazır deneyimi kullanır.
          </p>
        </div>
      </Panel>

      <div className="home-quick-grid">
        <Panel title="Bildirim tercihleri" subtitle="Hangi olaylar gösterilsin">
          <div className="list-stack">
            {[
              ['alerts', 'Alarm bildirimleri'],
              ['patterns', 'Formasyon bildirimleri'],
              ['ai', 'AI analiz bildirimleri'],
              ['news', 'Haber bildirimleri'],
              ['system', 'Sistem bildirimleri'],
              ['social', 'Sosyal bildirimler'],
              ['desktop', 'Masaüstü bildirimleri'],
              ['live', 'Canlı bildirimler']
            ].map(([key, label]) => (
              <label key={key} className="setting-row">
                <div>
                  <strong>{label}</strong>
                  <p>Bu kanal için bildirim gösterimini aç veya kapat.</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.notifications[key as keyof UserSettings['notifications']]}
                  onChange={(event) =>
                    onNotificationToggle(
                      key as keyof UserSettings['notifications'],
                      event.target.checked
                    )
                  }
                />
              </label>
            ))}
          </div>
        </Panel>

        <Panel title="Ses ve gizlilik" subtitle="Kişisel deneyimini ayarla">
          <div className="list-stack">
            <label className="setting-row">
              <div>
                <strong>Sesleri aktif tut</strong>
                <p>UI, mesaj ve bildirim seslerini tek noktadan yönet.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.sound.enabled}
                onChange={(event) => onSoundPreferenceChange('enabled', event.target.checked)}
              />
            </label>

            <label className="setting-row">
              <div>
                <strong>UI sesleri</strong>
                <p>Sayfa geçişleri ve buton etkileri için hafif sesler.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.sound.ui}
                onChange={(event) => onSoundPreferenceChange('ui', event.target.checked)}
              />
            </label>

            <label className="setting-row">
              <div>
                <strong>Mesaj sesleri</strong>
                <p>Sohbet kutucuğu ve mesaj gönderim etkileri.</p>
              </div>
              <input
                type="checkbox"
                checked={settings.sound.messages}
                onChange={(event) => onSoundPreferenceChange('messages', event.target.checked)}
              />
            </label>

            <label className="field-stack">
              <span>Ses seviyesi</span>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.sound.volume}
                onChange={(event) => onSoundPreferenceChange('volume', Number(event.target.value))}
              />
              <span className="hero-card__helper">Seviye: %{settings.sound.volume}</span>
            </label>

            <div className="field-stack">
              <span>Portföy gizliliği</span>
              <div className="filter-chip-row">
                {[
                  ['public', 'Herkese açık'],
                  ['friends', 'Sadece arkadaşlar'],
                  ['private', 'Gizli']
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={
                      settings.portfolioVisibility === value ? 'chip chip--active' : 'chip'
                    }
                    onClick={() =>
                      onPortfolioVisibilityChange(value as UserSettings['portfolioVisibility'])
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="inline-form">
              <StatusPill
                label={
                  settings.portfolioVisibility === 'public'
                    ? 'Herkese açık'
                    : settings.portfolioVisibility === 'friends'
                      ? 'Arkadaşlara açık'
                      : 'Gizli'
                }
                tone={settings.portfolioVisibility === 'private' ? 'neutral' : 'info'}
              />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
