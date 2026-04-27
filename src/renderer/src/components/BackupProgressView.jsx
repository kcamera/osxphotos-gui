import { useState, useEffect, useRef } from 'react'

const MAX_LINES = 1000

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function BackupProgressView({ onDone, isDryRun, startTime }) {
  const [lines, setLines] = useState([])
  const [result, setResult] = useState(null)
  const [now, setNow] = useState(Date.now())
  const logRef = useRef(null)

  useEffect(() => {
    const cleanLog = window.api.onBackupLog((newLines) => {
      setLines((prev) => {
        const next = [...prev, ...newLines]
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
      })
    })

    const cleanDone = window.api.onBackupDone((res) => {
      setResult(res)
    })

    return () => { cleanLog(); cleanDone() }
  }, [])

  // Tick the clock every second until done; elapsed anchored to startTime so remounts don't reset it
  useEffect(() => {
    if (result) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [result])

  const elapsed = startTime ? Math.floor((now - startTime) / 1000) : 0

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [lines])

  const handleCancel = async () => {
    await window.api.cancelBackup()
  }

  const title = () => {
    if (!result) return <span className="row"><span className="spinner" /> {isDryRun ? 'Preview in Progress' : 'Backup in Progress'} ({formatElapsed(elapsed)})</span>
    if (result.success) return isDryRun ? '✓ Preview Complete' : '✓ Backup Complete'
    if (result.interrupted) return isDryRun ? '⚠ Preview Stopped' : '⚠ Backup Stopped'
    return isDryRun ? '✕ Preview Failed' : '✕ Backup Failed'
  }

  const summaryText = (summary) => {
    const missing = summary.missing > 0 ? ` · ${summary.missing} missing originals` : ''
    if (isDryRun) {
      return `Would process ${summary.processed} items (${summary.exported} to export · ${summary.updated} to update · ${summary.skipped} to skip${missing})`
    }
    return `Processed ${summary.processed} items (${summary.exported} files exported · ${summary.updated} updated · ${summary.skipped} skipped${missing})`
  }

  return (
    <div className="overlay">
      <div className="sheet" style={{ maxHeight: '70vh' }}>
        <div className="sheet-header">
          <span className="sheet-title">{title()}</span>
          {result && (
            <button className="btn btn-secondary btn-sm" onClick={onDone}>Done</button>
          )}
        </div>

        {isDryRun && (
          <div className="banner banner-info">
            DRY RUN — no files will be written to disk
          </div>
        )}

        {result?.success && result.summary && (
          <div className="banner banner-success">
            {summaryText(result.summary)}
          </div>
        )}
        {result?.interrupted && (
          <div className="banner banner-warn">
            {isDryRun ? 'Preview stopped.' : 'Backup stopped. Your next run will resume where it left off.'}
          </div>
        )}
        {result && !result.success && !result.interrupted && (
          <div className="banner banner-error">
            {result.error ?? (isDryRun ? 'An error occurred during preview.' : 'An error occurred during backup.')}
          </div>
        )}

        <div className="log-view" ref={logRef} style={{ minHeight: 200 }}>
          {lines.length === 0 && (
            <p style={{ opacity: 0.4 }}>{isDryRun ? 'Starting osxphotos preview…' : 'Starting osxphotos export…'}</p>
          )}
          {lines.map((line, i) => <p key={i}>{line}</p>)}
        </div>

        {!result && (
          <button className="btn btn-danger btn-sm" onClick={handleCancel} style={{ alignSelf: 'flex-start' }}>
            {isDryRun ? 'Stop Preview' : 'Stop (resume next time)'}
          </button>
        )}
      </div>
    </div>
  )
}
