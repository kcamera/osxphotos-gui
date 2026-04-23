import { useState, useEffect, useRef } from 'react'

const MAX_LINES = 1000

export default function BackupProgressView({ onDone }) {
  const [lines, setLines] = useState([])
  const [result, setResult] = useState(null)
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

  // Auto-scroll to bottom
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [lines])

  const handleCancel = async () => {
    await window.api.cancelBackup()
  }

  return (
    <div className="overlay">
      <div className="sheet" style={{ maxHeight: '70vh' }}>
        <div className="sheet-header">
          <span className="sheet-title">
            {result
              ? result.success ? '✓ Backup Complete' : result.interrupted ? '⚠ Backup Stopped' : '✕ Backup Failed'
              : <span className="row"><span className="spinner" /> Backup in Progress</span>}
          </span>
          {result && (
            <button className="btn btn-secondary btn-sm" onClick={onDone}>Done</button>
          )}
        </div>

        {result?.success && result.summary && (
          <div className="banner banner-success">
            Processed {result.summary.processed} items ({result.summary.exported} files exported · {result.summary.updated} updated · {result.summary.skipped} skipped)
          </div>
        )}
        {result?.interrupted && (
          <div className="banner banner-warn">
            Backup stopped. Your next run will resume where it left off.
          </div>
        )}
        {result && !result.success && !result.interrupted && (
          <div className="banner banner-error">
            {result.error ?? 'An error occurred during backup.'}
          </div>
        )}

        <div className="log-view" ref={logRef} style={{ minHeight: 200 }}>
          {lines.length === 0 && <p style={{ opacity: 0.4 }}>Starting osxphotos export…</p>}
          {lines.map((line, i) => <p key={i}>{line}</p>)}
        </div>

        {!result && (
          <button className="btn btn-danger btn-sm" onClick={handleCancel} style={{ alignSelf: 'flex-start' }}>
            Stop (resume next time)
          </button>
        )}
      </div>
    </div>
  )
}
