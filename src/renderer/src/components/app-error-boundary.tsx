import type { ErrorInfo, ReactNode } from 'react'
import { Component } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  errorKey: number
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorKey: 0
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, errorKey: Date.now() }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('AVY render error', error, info)

    try {
      localStorage.setItem(
        'avy-last-render-error',
        JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          timestamp: new Date().toISOString()
        })
      )
    } catch {
      // Ignore storage failures in recovery mode.
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="state-card state-card--full">
          <p className="eyebrow">Kurtarma modu</p>
          <h1>AVY beklenmeyen bir görüntüleme hatası ile karşılaştı.</h1>
          <p>Güvenli biçimde yeniden yükleyip ana ekrana dönmeyi deneyebilirsin.</p>
          <div className="inline-form">
            <button
              type="button"
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Yeniden yükle
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                localStorage.removeItem('avy-last-render-error')
                window.location.href = `${window.location.origin}${window.location.pathname}`
              }}
            >
              Güvenli açılış dene
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
