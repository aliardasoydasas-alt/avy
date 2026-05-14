import { useState } from 'react'
import { LockKeyhole, LogIn, UserRoundPlus } from 'lucide-react'
import { AyLogo } from '@renderer/components/ay-logo'
import { StateCard } from '@renderer/components/state-card'
import type { SocialAuthMode } from '@renderer/hooks/use-social-cloud'

interface StartupAuthScreenProps {
  isConfigured: boolean
  isCheckingSession: boolean
  isBusy: boolean
  statusMessage?: string
  errorMessage?: string
  onAuthenticate: (
    mode: SocialAuthMode,
    input: {
      email: string
      password: string
      username: string
      displayName: string
    }
  ) => Promise<void>
}

export const StartupAuthScreen = ({
  isConfigured,
  isCheckingSession,
  isBusy,
  statusMessage,
  errorMessage,
  onAuthenticate
}: StartupAuthScreenProps) => {
  const [mode, setMode] = useState<SocialAuthMode>('login')
  const [form, setForm] = useState({
    email: '',
    password: '',
    username: '',
    displayName: ''
  })

  if (isCheckingSession) {
    return (
      <div className="auth-screen">
        <div className="auth-screen__card">
          <AyLogo />
          <StateCard
            title="Oturum kontrol ediliyor"
            description="Daha önce giriş yaptıysan AVY seni otomatik olarak hesabına bağlıyor."
          />
        </div>
      </div>
    )
  }

  if (!isConfigured) {
    return (
      <div className="auth-screen">
        <div className="auth-screen__card">
          <AyLogo />
          <StateCard
            title="Sosyal altyapı hazır değil"
            description="Uygulama hesapla açılacak şekilde ayarlandı fakat Supabase bağlantısı bulunamadı."
          />
        </div>
      </div>
    )
  }

  return (
    <div className="auth-screen">
      <section className="auth-screen__card">
        <AyLogo />

        <div className="auth-screen__copy">
          <p className="eyebrow">Hesap gerekli</p>
          <h2>AVY’ye devam etmek için giriş yap</h2>
          <p>
            Tüm piyasa, sosyal ve analiz özellikleri için giriş gerekiyor. Bir kez oturum açtığında
            sonraki açılışlarda seni otomatik içeri alacağız.
          </p>
        </div>

        <div className="tab-row">
          <button
            type="button"
            className={mode === 'login' ? 'tab-button tab-button--active' : 'tab-button'}
            onClick={() => setMode('login')}
          >
            <LogIn size={16} />
            Giriş yap
          </button>
          <button
            type="button"
            className={mode === 'register' ? 'tab-button tab-button--active' : 'tab-button'}
            onClick={() => setMode('register')}
          >
            <UserRoundPlus size={16} />
            Kaydol
          </button>
        </div>

        <div className="list-stack">
          <label className="field-stack">
            <span>E-posta</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((state) => ({ ...state, email: event.target.value }))}
              placeholder="ornek@mail.com"
            />
          </label>

          <label className="field-stack">
            <span>Şifre</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((state) => ({ ...state, password: event.target.value }))}
              placeholder="Şifreni gir"
            />
          </label>

          {mode === 'register' ? (
            <>
              <label className="field-stack">
                <span>Kullanıcı adı</span>
                <input
                  value={form.username}
                  onChange={(event) => setForm((state) => ({ ...state, username: event.target.value }))}
                  placeholder="arkadaşların seni bununla bulacak"
                />
              </label>

              <label className="field-stack">
                <span>Görünen ad</span>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm((state) => ({ ...state, displayName: event.target.value }))}
                  placeholder="Ad Soyad"
                />
              </label>
            </>
          ) : null}

          <button
            type="button"
            className="primary-button auth-screen__submit"
            disabled={isBusy}
            onClick={() => void onAuthenticate(mode, form)}
          >
            <LockKeyhole size={16} />
            {isBusy ? 'İşlem sürüyor...' : mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
          </button>

          {isBusy ? <p className="hero-card__helper">Sunucuyla bağlantı kuruluyor...</p> : null}
          {statusMessage ? <p className="hero-card__helper">{statusMessage}</p> : null}
          {errorMessage ? <p className="negative-text">{errorMessage}</p> : null}
        </div>
      </section>
    </div>
  )
}
