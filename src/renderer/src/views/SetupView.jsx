import { useState } from 'react'
import { useAppStore } from '../store/appStore.jsx'

export default function SetupView() {
  const { updateSettings, loadStatus } = useAppStore()
  const [destinationPath, setDestinationPath] = useState('')
  const [probeResult, setProbeResult] = useState(null)
  const [accessResult, setAccessResult] = useState(null)
  const [exportDbStatus, setExportDbStatus] = useState(null)
  const [probing, setProbing] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)

  const pickDestination = async () => {
    const path = await window.api.pickFolder()
    if (!path) return
    setDestinationPath(path)
    const hasDb = await window.api.checkExportDb(path)
    setExportDbStatus(hasDb ? 'existing' : 'fresh')
  }

  const autoDetect = async () => {
    setProbing(true)
    const { probe } = await window.api.probeTools()
    setProbeResult(probe)
    setProbing(false)
  }

  const testAccess = async () => {
    setTesting(true)
    const { defaults } = await window.api.probeTools()
    const result = await window.api.testAccess({
      pythonPath: probeResult?.python?.path,
      photosLibraryPath: defaults.photosLibrary,
    })
    setAccessResult(result)
    setTesting(false)
  }

  const allToolsOk = probeResult && probeResult.osxphotos.ok && probeResult.python.ok
  const canStart = destinationPath && allToolsOk && accessResult?.ok

  const handleStart = async () => {
    setSaving(true)
    const { defaults } = await window.api.probeTools()
    await updateSettings({
      destinationPath,
      osxphotosPath: probeResult.osxphotos.path,
      pythonPath: probeResult.python.path,
      photosLibraryPath: defaults.photosLibrary,
      downloadMissing: false,
    })
    await loadStatus()
    setSaving(false)
  }

  return (
    <div className="app">
      <div className="titlebar" />

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>📸</div>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>OSXPhotos Backup</h1>
        <p className="muted" style={{ marginTop: 6 }}>Let's get your backup destination set up.</p>
      </div>

      {/* Step 1: Destination */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>1. Choose backup destination</div>
        <div className="form-row">
          <input className="input" value={destinationPath} readOnly placeholder="Not set" />
          <button className="btn btn-secondary btn-sm" onClick={pickDestination}>Choose…</button>
        </div>
        {exportDbStatus === 'existing' && (
          <div className="banner banner-success" style={{ fontSize: 12 }}>Existing backup detected — incremental mode ✓</div>
        )}
        {exportDbStatus === 'fresh' && (
          <div className="banner banner-info" style={{ fontSize: 12 }}>No existing backup found — first run will export all photos.</div>
        )}
      </div>

      {/* Step 2: Tools */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>2. Detect tools</div>
        <button className="btn btn-secondary btn-sm" onClick={autoDetect} disabled={probing} style={{ alignSelf: 'flex-start' }}>
          {probing ? <><span className="spinner" /> Detecting…</> : '⚡ Auto-detect'}
        </button>
        {probeResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {['osxphotos', 'python', 'exiftool'].map((tool) => {
              const optional = tool === 'exiftool'
              const ok = probeResult[tool].ok
              const cls = ok ? 'banner-success' : optional ? 'banner-warn' : 'banner-error'
              const label = ok ? `✓ ${probeResult[tool].version}` : optional ? `not found (optional)` : probeResult[tool].error
              return (
                <div key={tool} className={`banner ${cls}`} style={{ fontSize: 12 }}>
                  {tool}: {label}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Step 3: TCC */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontWeight: 600 }}>3. Grant library access</div>
        <div className="muted" style={{ fontSize: 12 }}>
          If prompted, grant <strong>Full Disk Access</strong> to this app in System Settings › Privacy & Security › Full Disk Access.
        </div>
        <button className="btn btn-secondary btn-sm" onClick={testAccess} disabled={testing || !probeResult?.python?.ok} style={{ alignSelf: 'flex-start' }}>
          {testing ? <><span className="spinner" /> Testing…</> : '🔑 Test Library Access'}
        </button>
        {accessResult && (
          <div className={`banner ${accessResult.ok ? 'banner-success' : 'banner-error'}`} style={{ fontSize: 12 }}>
            {accessResult.ok
              ? '✓ Access granted'
              : '✕ Access denied — open System Settings › Privacy & Security › Full Disk Access and add this app, then try again'}
          </div>
        )}
      </div>

      <button className="btn btn-primary btn-large" onClick={handleStart} disabled={!canStart || saving}>
        {saving ? 'Setting up…' : 'Get Started →'}
      </button>

      </div>
    </div>
  )
}
