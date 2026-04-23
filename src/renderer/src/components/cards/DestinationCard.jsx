import CardFrame from '../CardFrame.jsx'

function fmt(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let v = bytes
  let i = 0
  while (v >= 1000 && i < units.length - 1) { v /= 1000; i++ }
  return `${v.toFixed(i < 2 ? 0 : 1)} ${units[i]}`
}

export default function DestinationCard({ destStatus, settings }) {
  const path = settings?.destinationPath
  const available = destStatus?.status === 'available'
  const dotColor = !path ? 'gray' : available ? 'green' : 'red'

  const used = destStatus?.backupDirBytes ?? 0
  const free = destStatus?.freeBytes ?? 0
  const total = destStatus?.totalBytes ?? 0

  return (
    <CardFrame title="Destination" dotColor={dotColor}>
      {!path ? (
        <>
          <div className="card-value loading">—</div>
          <div className="card-sub">Not configured</div>
        </>
      ) : destStatus?.status === 'unavailable' ? (
        <>
          <div className="card-value" style={{ fontSize: 18, color: 'var(--red)' }}>Drive offline</div>
          <div className="card-sub muted" style={{ wordBreak: 'break-all' }}>{path}</div>
        </>
      ) : destStatus?.status === 'checking' ? (
        <>
          <div className="card-value loading">—</div>
          <div className="card-sub">Checking…</div>
        </>
      ) : (
        <>
          <div className="card-value">{used > 0 ? fmt(used) + ' used' : fmt(total - free) + ' used'}</div>
          <div className="card-sub">
            {total > 0 ? `of ${fmt(total)} · ${fmt(free)} free` : 'Drive available'}
          </div>
        </>
      )}
    </CardFrame>
  )
}
