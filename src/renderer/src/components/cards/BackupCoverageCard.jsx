import CardFrame from '../CardFrame.jsx'

export default function BackupCoverageCard({ exportedCount, libraryStatus }) {
  const total = libraryStatus != null
    ? (libraryStatus.total_photos ?? 0) + (libraryStatus.total_videos ?? 0)
    : null

  const complete = exportedCount != null && total != null && exportedCount >= total
  const dotColor = exportedCount == null ? 'gray' : complete ? 'green' : exportedCount === 0 ? 'red' : 'yellow'

  const value = exportedCount == null
    ? '—'
    : complete
      ? 'All backed up'
      : exportedCount.toLocaleString() + ' backed up'

  const sub = exportedCount == null
    ? 'Run a backup to see coverage'
    : total == null
      ? 'counting library…'
      : complete
        ? `${total.toLocaleString()} items`
        : `of ${total.toLocaleString()} total`

  return (
    <CardFrame title="Backup Coverage" dotColor={dotColor}>
      <div className={`card-value ${exportedCount == null ? 'loading' : ''}`}>
        {value}
      </div>
      <div className="card-sub">{sub}</div>
    </CardFrame>
  )
}
