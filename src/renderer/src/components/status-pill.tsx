import clsx from 'clsx'

interface StatusPillProps {
  label: string
  tone?: 'positive' | 'negative' | 'neutral' | 'info'
}

export const StatusPill = ({ label, tone = 'neutral' }: StatusPillProps) => (
  <span className={clsx('status-pill', `status-pill--${tone}`)}>{label}</span>
)
