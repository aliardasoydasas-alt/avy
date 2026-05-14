import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Bell,
  ChevronDown,
  LogOut,
  MoonStar,
  Palette,
  Settings2,
  Smartphone,
  SunMedium,
  UserRound,
  WalletCards
} from 'lucide-react'
import { LiveNotificationCenter } from '@renderer/features/notifications/live-notification-center'
import { NotificationCenter } from '@renderer/features/notifications/notification-center'
import { TerminalIconRail } from '@renderer/features/shell/terminal-icon-rail'
import { SocialAvatar } from '@renderer/features/social/social-avatar'
import type { NotificationItem } from '@shared/types/alerts'
import type { MarketOverviewItem } from '@shared/types/market'
import type { UserProfile } from '@shared/types/social'
import type { LiveNotificationSettings, ProfileSection, ThemeMode } from '@shared/types/user'

interface TopToolbarProps {
  activeScreen: 'home' | 'ai' | 'highlights' | 'investors' | 'asset' | 'profile' | 'social'
  currentUser: UserProfile
  notifications: NotificationItem[]
  liveNotifications: NotificationItem[]
  liveNotificationSettings: LiveNotificationSettings
  portfolioValueTry: number
  assetLookup: Map<string, MarketOverviewItem>
  onReadNotification: (notificationId: string) => void
  onReadAllNotifications: () => void
  onOpenProfileSection: (section: ProfileSection) => void
  onSelectScreen: (screen: 'home' | 'ai' | 'highlights' | 'investors' | 'profile') => void
  onLiveNotificationSettingChange: <Key extends keyof LiveNotificationSettings>(
    key: Key,
    value: LiveNotificationSettings[Key]
  ) => void
  onSendLiveNotificationTest: () => Promise<void>
  themeMode: ThemeMode
  onToggleTheme: () => void
  onSignOut: () => void
}

export const TopToolbar = ({
  activeScreen,
  currentUser,
  notifications,
  liveNotifications,
  liveNotificationSettings,
  portfolioValueTry,
  assetLookup,
  onReadNotification,
  onReadAllNotifications,
  onOpenProfileSection,
  onSelectScreen,
  onLiveNotificationSettingChange,
  onSendLiveNotificationTest,
  themeMode,
  onToggleTheme,
  onSignOut
}: TopToolbarProps) => {
  const [isLiveNotificationsOpen, setIsLiveNotificationsOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  )

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) {
        setIsLiveNotificationsOpen(false)
        setIsNotificationsOpen(false)
        setIsProfileMenuOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    return () => window.removeEventListener('mousedown', handlePointerDown)
  }, [])

  return (
    <div ref={toolbarRef} className="app-topbar">
      <div className="app-topbar__actions">
        <div className="toolbar-terminal-nav">
          <TerminalIconRail
            activeScreen={activeScreen}
            onSelectScreen={onSelectScreen}
            orientation="horizontal"
          />
        </div>

        <div className="toolbar-popover">
          <button
            type="button"
            className={
              isLiveNotificationsOpen ? 'toolbar-icon-button toolbar-icon-button--active' : 'toolbar-icon-button'
            }
            onClick={() => {
              setIsLiveNotificationsOpen((current) => !current)
              setIsNotificationsOpen(false)
              setIsProfileMenuOpen(false)
            }}
          >
            <Smartphone size={18} />
          </button>

          {isLiveNotificationsOpen ? (
            <div className="toolbar-popover__panel toolbar-popover__panel--notifications">
              <LiveNotificationCenter
                settings={liveNotificationSettings}
                portfolioValueTry={portfolioValueTry}
                liveNotifications={liveNotifications}
                onSettingChange={onLiveNotificationSettingChange}
                onSendTest={onSendLiveNotificationTest}
              />
            </div>
          ) : null}
        </div>

        <div className="toolbar-popover">
          <button
            type="button"
            className={
              isNotificationsOpen ? 'toolbar-icon-button toolbar-icon-button--active' : 'toolbar-icon-button'
            }
            onClick={() => {
              setIsNotificationsOpen((current) => !current)
              setIsLiveNotificationsOpen(false)
              setIsProfileMenuOpen(false)
            }}
          >
            <Bell size={18} />
            {unreadCount ? <span className="notification-count">{unreadCount}</span> : null}
          </button>

          {isNotificationsOpen ? (
            <div className="toolbar-popover__panel toolbar-popover__panel--notifications">
              <NotificationCenter
                notifications={notifications}
                assetLookup={assetLookup}
                onRead={onReadNotification}
                onReadAll={onReadAllNotifications}
                compact
              />
            </div>
          ) : null}
        </div>

        <div className="toolbar-popover">
          <button
            type="button"
            className={
              isProfileMenuOpen ? 'toolbar-profile-button toolbar-profile-button--active' : 'toolbar-profile-button'
            }
            onClick={() => {
              setIsProfileMenuOpen((current) => !current)
              setIsLiveNotificationsOpen(false)
              setIsNotificationsOpen(false)
            }}
          >
            <SocialAvatar
              className="social-avatar social-avatar--mini"
              displayName={currentUser.displayName}
              username={currentUser.username}
              avatarDataUrl={currentUser.avatarDataUrl}
            />
            <div className="toolbar-profile-button__copy">
              <strong>{currentUser.displayName || 'Yeni kullanıcı'}</strong>
              <span>@{currentUser.username || 'profil'}</span>
            </div>
            <ChevronDown size={16} />
          </button>

          {isProfileMenuOpen ? (
            <div className="toolbar-popover__panel toolbar-popover__panel--profile">
              <div className="toolbar-profile-menu__header">
                <div>
                  <strong>{currentUser.displayName || 'Yeni kullanıcı'}</strong>
                  <p>@{currentUser.username || 'kullanıcı-adi-bekleniyor'}</p>
                </div>
              </div>

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  onOpenProfileSection('overview')
                  setIsProfileMenuOpen(false)
                }}
              >
                <UserRound size={16} />
                <span>Profil</span>
              </button>

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  onOpenProfileSection('holdings')
                  setIsProfileMenuOpen(false)
                }}
              >
                <WalletCards size={16} />
                <span>Varlıklarım</span>
              </button>

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  onOpenProfileSection('settings')
                  setIsProfileMenuOpen(false)
                }}
              >
                <Settings2 size={16} />
                <span>Ayarlar</span>
              </button>

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  onOpenProfileSection('settings')
                  setIsProfileMenuOpen(false)
                }}
              >
                <Palette size={16} />
                <span>Profil görünümü</span>
              </button>

              <button
                type="button"
                className="toolbar-menu-item"
                onClick={() => {
                  onToggleTheme()
                  setIsProfileMenuOpen(false)
                }}
              >
                {themeMode === 'dark' ? <SunMedium size={16} /> : <MoonStar size={16} />}
                <span>{themeMode === 'dark' ? 'Aydınlık mod' : 'Karanlık mod'}</span>
              </button>

              <button
                type="button"
                className="toolbar-menu-item toolbar-menu-item--danger"
                onClick={() => {
                  onSignOut()
                  setIsProfileMenuOpen(false)
                }}
              >
                <LogOut size={16} />
                <span>Çıkış</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
