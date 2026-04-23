import CardFrame from '../CardFrame.jsx'

export default function iCloudStatusCard({ libraryStatus }) {
  const missing = libraryStatus?.missing_count ?? null
  const total = libraryStatus != null
    ? (libraryStatus.total_photos ?? 0) + (libraryStatus.total_videos ?? 0)
    : null
  const cloud = libraryStatus?.cloud_asset_count ?? null

  const dotColor = missing == null ? 'gray' : missing === 0 ? 'green' : 'yellow'

  return (
    <CardFrame title="iCloud Status" dotColor={dotColor}>
      <div className={`card-value ${missing == null ? 'loading' : ''}`}>
        {missing == null ? '—' : missing.toLocaleString() + ' cloud-only'}
      </div>
      <div className="card-sub">
        {total != null
          ? `of ${total.toLocaleString()} total · ${(cloud ?? 0).toLocaleString()} iCloud assets`
          : 'Loading…'}
      </div>
      {missing != null && missing > 0 && (
        <div className="card-sub" style={{ marginTop: 4, color: 'var(--yellow)', fontSize: 11 }}>
          These originals live in iCloud only — enable "Download Missing" to include them in backups.
        </div>
      )}
    </CardFrame>
  )
}
