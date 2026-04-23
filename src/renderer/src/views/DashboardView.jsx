import { useState } from 'react'
import { useAppStore } from '../store/appStore.jsx'
import LastBackupCard from '../components/cards/LastBackupCard.jsx'
import PendingCard from '../components/cards/PendingCard.jsx'
import DestinationCard from '../components/cards/DestinationCard.jsx'
import ICloudStatusCard from '../components/cards/iCloudStatusCard.jsx'
import BackupProgressView from '../components/BackupProgressView.jsx'

function disabledReason(destStatus, settings, backupPhase) {
  if (backupPhase === 'running') return 'Backup in progress…'
  if (!settings?.destinationPath) return 'No backup destination configured'
  if (destStatus?.status === 'unavailable') return 'Backup destination is not available'
  if (destStatus?.status === 'checking') return 'Checking destination…'
  if (!settings?.osxphotosPath) return 'osxphotos not configured — check Settings'
  if (!settings?.exiftoolPath && settings?.exiftoolPath !== undefined) return null // exiftool optional warning handled separately
  return null
}

const PRESETS = [
  { key: 'all', label: 'All time' },
  { key: '5yr', label: 'Last 5 yrs' },
  { key: '2yr', label: 'Last 2 yrs' },
  { key: '1yr', label: 'Last 1 yr' },
  { key: 'custom', label: 'Custom…' },
]

export default function DashboardView({ onOpenSettings }) {
  const { settings, backupState, destStatus, libraryStatus, isRefreshing, backupPhase, setBackupPhase, updateSettings, refresh } = useAppStore()
  const [showProgress, setShowProgress] = useState(false)

  const reason = disabledReason(destStatus, settings, backupPhase)
  const canBackup = !reason

  const handleBackup = async () => {
    setShowProgress(true)
    setBackupPhase('running')
    await window.api.startBackup()
    setBackupPhase('idle')
  }

  const handleProgressDone = () => {
    setShowProgress(false)
    refresh()
  }

  const handlePresetChange = async (preset) => {
    await updateSettings({ ...settings, fromDatePreset: preset })
    if (preset !== 'custom' || settings.fromDateCustom) refresh()
  }

  const handleCustomDateChange = async (date) => {
    await updateSettings({ ...settings, fromDatePreset: 'custom', fromDateCustom: date })
    if (date) refresh()
  }

  const preset = settings?.fromDatePreset ?? 'all'
  const customDate = settings?.fromDateCustom ?? ''

  return (
    <div className="app">
      {/* Invisible titlebar drag region */}
      <div className="titlebar" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', paddingTop: 12, paddingRight: 12 }}>
        <div className="titlebar-actions row" style={{ gap: 8 }}>
          <button
            className="btn btn-secondary btn-icon"
            onClick={refresh}
            disabled={isRefreshing}
            title="Refresh status"
          >
            {isRefreshing ? <span className="spinner" /> : '↻'}
          </button>
          <button className="btn btn-secondary btn-icon" onClick={onOpenSettings} title="Settings" style={{ fontSize: 20 }}>⚙</button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16, overflow: 'hidden' }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, textAlign: 'center' }}>OSXPhotos Backup</h1>

        <div className="card-grid">
          <LastBackupCard backupState={backupState} />
          <PendingCard backupState={backupState} libraryStatus={libraryStatus} isRefreshing={isRefreshing} />
          <DestinationCard destStatus={destStatus} settings={settings} />
          <ICloudStatusCard libraryStatus={libraryStatus} />
        </div>

        {/* Date range filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span className="muted" style={{ fontSize: 12 }}>Range:</span>
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              className={`btn btn-sm ${preset === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => handlePresetChange(key)}
              disabled={backupPhase === 'running'}
            >
              {label}
            </button>
          ))}
          {preset === 'custom' && (
            <input
              type="date"
              className="input"
              style={{ width: 'auto', flex: 'none', fontSize: 12, padding: '4px 8px' }}
              value={customDate}
              onChange={(e) => handleCustomDateChange(e.target.value)}
            />
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-primary btn-large"
            onClick={handleBackup}
            disabled={!canBackup}
          >
            {backupPhase === 'running' ? <><span className="spinner" /> Backing up…</> : 'Back Up Now'}
          </button>
          {reason && <span className="muted">{reason}</span>}
          {isRefreshing && !reason && <span className="muted">Refreshing status…</span>}
        </div>
      </div>

      {showProgress && <BackupProgressView onDone={handleProgressDone} />}
    </div>
  )
}
