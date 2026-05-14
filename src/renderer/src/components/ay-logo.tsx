import avyLogo from '@renderer/assets/avy-logo.png'

interface AyLogoProps {
  compact?: boolean
  showText?: boolean
}

const RobotMark = () => <img className="brand-mark" src={avyLogo} alt="AVY logo" />

export const AyLogo = ({ compact = false, showText = true }: AyLogoProps) => (
  <div className={compact ? 'brand-lockup brand-lockup--compact' : 'brand-lockup'}>
    <RobotMark />
    {showText ? (
      <div>
        <span className="eyebrow">MARKET TERMINAL</span>
        <h1>AVY</h1>
      </div>
    ) : null}
  </div>
)
