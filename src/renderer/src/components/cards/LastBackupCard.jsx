import CardFrame from '../CardFrame.jsx'

function relativeTime(isoDate) {
  if (!isoDate) return 'Never'
  const diff = Date.now() - new Date(isoDate).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

function dotColor(isoDate, outcome) {
  if (!isoDate || outcome === 'never') return 'red'
  const days = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000)
  if (days < 7) return 'green'
  if (days < 30) return 'yellow'
  return 'red'
}

export default function LastBackupCard({ backupState }) {
  const { lastBackupDate, lastExportedCount, lastSummary, outcome, lastBackupErrorMessage } = backupState ?? {}
  const color = dotColor(lastBackupDate, outcome)

  const successSub = lastSummary
    ? `Processed ${lastSummary.processed} items (${lastSummary.exported} files exported · ${lastSummary.updated} updated · ${lastSummary.skipped} skipped)`
    : lastExportedCount != null
      ? `Exported ${lastExportedCount.toLocaleString()} file${lastExportedCount !== 1 ? 's' : ''}`
      : null

  return (
    <CardFrame title="Last Backup" dotColor={color}>
      <div className="card-value">{relativeTime(lastBackupDate)}</div>
      {outcome === 'succeeded' && successSub && (
        <div className="card-sub">{successSub}</div>
      )}
      {outcome === 'failed' && (
        <div className="card-sub" style={{ color: 'var(--red)' }}>Failed — {lastBackupErrorMessage ?? 'unknown error'}</div>
      )}
      {outcome === 'interrupted' && (
        <div className="card-sub" style={{ color: 'var(--yellow)' }}>Interrupted — safe to retry</div>
      )}
      {(!outcome || outcome === 'never') && (
        <div className="card-sub">No backup yet</div>
      )}
    </CardFrame>
  )
}
