import CardFrame from '../CardFrame.jsx'

function formatBytes(bytes) {
  if (bytes == null || bytes === 0) return null
  if (bytes >= 1e12) return `${(bytes / 1e12).toFixed(1)} TB`
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`
  return `${Math.round(bytes / 1e3)} KB`
}

function dotColor(count, isFirstRun) {
  if (isFirstRun) return 'red'
  if (count === 0) return 'green'
  if (count < 100) return 'yellow'
  return 'red'
}

export default function PendingCard({ backupState, libraryStatus, isRefreshing }) {
  const isFirstRun = !backupState?.lastBackupDate || backupState?.outcome === 'never'
  // photos_added_since_date is null when no --since was passed (fresh/new destination)
  const isFreshDestination = !isFirstRun && libraryStatus?.success && libraryStatus.photos_added_since_date == null

  let count = null
  let label = ''
  let sizeLabel = null

  if (libraryStatus?.success) {
    if (isFirstRun) {
      count = (libraryStatus.total_photos ?? 0) + (libraryStatus.total_videos ?? 0)
      label = 'First backup — all items pending'
    } else if (isFreshDestination) {
      count = (libraryStatus.total_photos ?? 0) + (libraryStatus.total_videos ?? 0)
      label = 'New destination — all items pending'
    } else {
      count = libraryStatus.photos_added_since_date ?? 0
      const since = backupState?.lastBackupDate
        ? new Date(backupState.lastBackupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : ''
      label = since ? `since ${since}` : ''
    }
    sizeLabel = formatBytes(libraryStatus.pending_size_bytes)
  }

  const color = count == null ? 'gray' : dotColor(count, isFirstRun || isFreshDestination)

  return (
    <CardFrame title="Pending" dotColor={color}>
      <div className={`card-value ${count == null ? 'loading' : ''}`}>
        {count == null ? '—' : count.toLocaleString() + (count === 1 ? ' item' : ' items')}
        {isRefreshing && <span style={{ marginLeft: 8 }}><span className="spinner" /></span>}
      </div>
      <div className="card-sub">{label || (libraryStatus == null ? 'Loading…' : '')}</div>
      {sizeLabel && <div className="card-sub">{sizeLabel}</div>}
    </CardFrame>
  )
}
