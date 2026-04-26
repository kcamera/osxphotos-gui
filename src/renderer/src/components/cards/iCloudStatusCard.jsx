import CardFrame from '../CardFrame.jsx'

export default function iCloudStatusCard({ libraryStatus }) {
  const toDownload = libraryStatus?.pending_missing_count ?? null

  const dotColor = toDownload == null ? 'gray' : toDownload === 0 ? 'green' : 'yellow'

  return (
    <CardFrame title="iCloud Downloads" dotColor={dotColor}>
      <div className={`card-value ${toDownload == null ? 'loading' : ''}`}>
        {toDownload == null ? '—' : toDownload === 0 ? 'Nothing to download' : toDownload.toLocaleString() + ' to download'}
      </div>
      <div className="card-sub">
        {toDownload == null
          ? 'Loading…'
          : toDownload === 0
            ? 'All pending items are on this Mac'
            : 'will be fetched from iCloud during backup'}
      </div>
    </CardFrame>
  )
}
