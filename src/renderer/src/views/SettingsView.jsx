import { useState } from 'react'
import { useAppStore } from '../store/appStore.jsx'

export default function SettingsView({ onClose }) {
  const { settings, updateSettings, refresh } = useAppStore()
  const [form, setForm] = useState({ ...settings })
  const [probeResult, setProbeResult] = useState(null)
  const [probing, setProbing] = useState(false)
  const [accessResult, setAccessResult] = useState(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [exportDbStatus, setExportDbStatus] = useState(null)

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: typeof e === 'string' ? e : e.target.value }))

  const checkDestination = async (path) => {
    if (!path) { setExportDbStatus(null); return }
    try {
      const hasDb = await window.api.checkExportDb(path)
      setExportDbStatus(hasDb ? 'existing' : 'fresh')
    } catch { setExportDbStatus(null) }
  }

  const pick = async (key) => {
    const path = await window.api.pickFolder()
    if (path) {
      setForm((f) => ({ ...f, [key]: path }))
      if (key === 'destinationPath') checkDestination(path)
    }
  }

  const autoDetect = async () => {
    setProbing(true)
    const { probe, defaults } = await window.api.probeTools()
    setProbeResult(probe)
    setForm((f) => ({
      ...f,
      osxphotosPath: probe.osxphotos.ok ? probe.osxphotos.path : f.osxphotosPath,
      pythonPath: probe.python.ok ? probe.python.path : f.pythonPath,
      photosLibraryPath: f.photosLibraryPath || defaults.photosLibrary,
    }))
    setProbing(false)
  }

  const testAccess = async () => {
    setTesting(true)
    setAccessResult(null)
    const result = await window.api.testAccess()
    setAccessResult(result)
    setTesting(false)
  }

  const save = async () => {
    setSaving(true)
    await updateSettings(form)
    onClose()
    refresh() // re-reads state from disk and re-queries library status
    setSaving(false)
  }

  return (
    <div className="overlay">
      <div className="sheet" style={{ gap: 14, overflowY: 'auto' }}>
        <div className="sheet-header">
          <span className="sheet-title">Settings</span>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>Cancel</button>
        </div>

        {/* Backup Destination */}
        <div className="form-group">
          <div className="form-label">Backup Destination</div>
          <div className="form-row">
            <input
              className="input"
              value={form.destinationPath}
              onChange={(e) => { setForm((f) => ({ ...f, destinationPath: e.target.value })); setExportDbStatus(null) }}
              onBlur={(e) => checkDestination(e.target.value)}
              placeholder="/Volumes/MySSD/PhotoBackup"
            />
            <button className="btn btn-secondary btn-sm" onClick={() => pick('destinationPath')}>Choose…</button>
          </div>
          {exportDbStatus === 'existing' && (
            <div className="banner banner-success" style={{ fontSize: 12 }}>Existing backup detected — incremental mode ✓</div>
          )}
          {exportDbStatus === 'fresh' && (
            <div className="banner banner-info" style={{ fontSize: 12 }}>No existing backup found — first run will export all photos. If migrating from another location, copy files with <code>rsync -a</code> first.</div>
          )}
        </div>

        {/* Tool paths */}
        <div className="form-group">
          <div className="form-label">osxphotos Binary</div>
          <div className="form-row">
            <input className="input" value={form.osxphotosPath} onChange={set('osxphotosPath')} placeholder="~/.local/bin/osxphotos" />
          </div>
        </div>
        <div className="form-group">
          <div className="form-label">Python (osxphotos venv)</div>
          <div className="form-row">
            <input className="input" value={form.pythonPath} onChange={set('pythonPath')} placeholder="~/.local/pipx/venvs/osxphotos/bin/python" />
          </div>
        </div>
        <div className="form-group">
          <div className="form-label">Photos Library</div>
          <div className="form-row">
            <input className="input" value={form.photosLibraryPath} onChange={set('photosLibraryPath')} placeholder="~/Pictures/Photos Library.photoslibrary" />
            <button className="btn btn-secondary btn-sm" onClick={() => pick('photosLibraryPath')}>Choose…</button>
          </div>
        </div>

        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={autoDetect} disabled={probing}>
            {probing ? <><span className="spinner" /> Detecting…</> : '⚡ Auto-detect Tools'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={testAccess} disabled={testing}>
            {testing ? <><span className="spinner" /> Testing…</> : '🔑 Test Library Access'}
          </button>
        </div>

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

        {accessResult && (
          <div className={`banner ${accessResult.ok ? 'banner-success' : 'banner-error'}`} style={{ fontSize: 12 }}>
            {accessResult.ok ? '✓ Library access granted' : `✕ ${accessResult.error} — Grant Full Disk Access in System Settings > Privacy & Security`}
          </div>
        )}

        {/* Download missing toggle */}
        <div className="toggle-row">
          <div>
            <div className="toggle-label">Download Missing from iCloud</div>
            <div className="toggle-desc">Force-download iCloud-only originals before export (required for Optimize Mac Storage mode)</div>
          </div>
          <label className="toggle-switch">
            <input type="checkbox" checked={form.downloadMissing} onChange={(e) => setForm((f) => ({ ...f, downloadMissing: e.target.checked }))} />
            <span className="toggle-track" />
            <span className="toggle-thumb" />
          </label>
        </div>

        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}
