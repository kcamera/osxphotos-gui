import StatusDot from './StatusDot.jsx'

export default function CardFrame({ title, dotColor, children }) {
  return (
    <div className="card">
      <div className="card-title">
        {dotColor && <StatusDot color={dotColor} />}
        {title}
      </div>
      {children}
    </div>
  )
}
