import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { AppProviders } from './app/providers'
import { AppErrorBoundary } from './components/app-error-boundary'
import './styles/app.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </AppErrorBoundary>
  </React.StrictMode>
)
