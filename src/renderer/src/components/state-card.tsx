interface StateCardProps {
  title: string
  description: string
}

export const StateCard = ({ title, description }: StateCardProps) => (
  <div className="state-card">
    <h3>{title}</h3>
    <p>{description}</p>
  </div>
)
