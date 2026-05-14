import type { PropsWithChildren, ReactNode } from 'react'
import clsx from 'clsx'

interface PanelProps extends PropsWithChildren {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}

export const Panel = ({ title, subtitle, action, className, children }: PanelProps) => (
  <section className={clsx('panel', className)}>
    <header className="panel__header">
      <div>
        <p className="eyebrow">{title}</p>
        {subtitle ? <h2>{subtitle}</h2> : null}
      </div>
      {action}
    </header>
    <div className="panel__body">{children}</div>
  </section>
)
