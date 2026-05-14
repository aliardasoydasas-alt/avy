import { memo } from 'react'
import { Bot, BriefcaseBusiness, CandlestickChart, Flame, UserRound } from 'lucide-react'

type TerminalScreenTarget = 'home' | 'ai' | 'highlights' | 'investors' | 'profile'

interface TerminalIconRailProps {
  activeScreen: 'home' | 'ai' | 'highlights' | 'investors' | 'asset' | 'profile' | 'social'
  onSelectScreen: (screen: TerminalScreenTarget) => void
  orientation?: 'vertical' | 'horizontal'
}

const screenItems: Array<{
  id: TerminalScreenTarget
  label: string
  icon: typeof CandlestickChart
}> = [
  { id: 'home', label: 'Piyasa terminali', icon: CandlestickChart },
  { id: 'ai', label: 'AI', icon: Bot },
  { id: 'highlights', label: 'Öne çıkanlar', icon: Flame },
  { id: 'investors', label: 'Yatırımcılar', icon: BriefcaseBusiness },
  { id: 'profile', label: 'Profil', icon: UserRound }
]

const TerminalIconRailComponent = ({
  activeScreen,
  onSelectScreen,
  orientation = 'vertical'
}: TerminalIconRailProps) => (
  <div
    className={
      orientation === 'horizontal'
        ? 'terminal-icon-rail terminal-icon-rail--horizontal'
        : 'terminal-icon-rail'
    }
  >
    {screenItems.map((item) => {
      const Icon = item.icon
      const isActive =
        item.id === 'home'
          ? activeScreen === 'home' || activeScreen === 'asset'
          : activeScreen === item.id

      return (
        <button
          key={item.id}
          type="button"
          className={isActive ? 'terminal-icon-rail__button terminal-icon-rail__button--active' : 'terminal-icon-rail__button'}
          onClick={() => onSelectScreen(item.id)}
          title={item.label}
          aria-label={item.label}
        >
          <Icon size={18} />
        </button>
      )
    })}
  </div>
)

export const TerminalIconRail = memo(TerminalIconRailComponent)
