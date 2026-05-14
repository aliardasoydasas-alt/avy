import avyLogo from '@renderer/assets/avy-logo.png'

export const IntroSplash = () => (
  <div className="intro-splash">
    <div className="intro-splash__stage">
      <div className="intro-splash__ring" aria-hidden="true" />
      <div className="intro-splash__ring intro-splash__ring--inner" aria-hidden="true" />
      <img className="intro-splash__logo" src={avyLogo} alt="AVY logo" />
    </div>

    <div className="intro-splash__copy">
      <p className="eyebrow">AVY MARKET TERMINAL</p>
      <h1>AVY</h1>
      <p>Piyasa panelleri hazirlaniyor...</p>
    </div>
  </div>
)
