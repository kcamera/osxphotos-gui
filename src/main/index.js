import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync, statSync } from 'fs'
import { execFileSync } from 'child_process'
import { settingsStore } from './services/settingsStore.js'
import { backupStateStore } from './services/backupStateStore.js'
import { LibraryStatusService } from './services/libraryStatusService.js'
import { DestinationMonitor } from './services/destinationMonitor.js'
import { OsxphotosService } from './services/osxphotosService.js'
import { notificationService } from './services/notificationService.js'
import { pathProbe, defaultPaths } from './utils/pathProbe.js'

// Enforce single instance
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let mainWindow = null
const destinationMonitor = new DestinationMonitor()
const osxphotosService = new OsxphotosService()

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 600,
    minWidth: 820,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    title: 'OSXPhotos Backup',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

app.whenReady().then(() => {
  createWindow()

  // If a previous session crashed mid-backup, mark as interrupted
  const state = backupStateStore.load()
  if (state.outcome === 'running') {
    backupStateStore.save({ ...state, outcome: 'interrupted' })
  }

  // Start monitoring destination if configured
  const settings = settingsStore.load()
  if (settings.destinationPath) {
    destinationMonitor.start(settings.destinationPath, (status) => {
      mainWindow?.webContents.send('destination-status', status)
    })
  }
})

app.on('window-all-closed', () => {
  destinationMonitor.stop()
  app.quit()
})

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function dbSize(destinationPath) {
  if (!destinationPath) return 0
  try { return statSync(join(destinationPath, '.osxphotos_export.db')).size } catch { return 0 }
}

function readExportedCount(destinationPath) {
  if (!destinationPath || dbSize(destinationPath) === 0) return null
  const dbPath = join(destinationPath, '.osxphotos_export.db')
  try {
    const out = execFileSync(
      '/usr/bin/sqlite3',
      [dbPath, 'SELECT COUNT(DISTINCT uuid) FROM export_data WHERE uuid IS NOT NULL'],
      { timeout: 5000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    ).trim()
    const n = parseInt(out, 10)
    return isNaN(n) ? null : n
  } catch { return null }
}

function computeFromDate(preset, custom) {
  if (!preset || preset === 'all') return null
  if (preset === 'custom') return custom || null
  const years = { '1yr': 1, '2yr': 2, '5yr': 5 }[preset]
  if (!years) return null
  const d = new Date()
  d.setFullYear(d.getFullYear() - years)
  return d.toISOString().split('T')[0] // YYYY-MM-DD
}

// ── IPC Handlers ────────────────────────────────────────────────────────────

ipcMain.handle('get-status', () => {
  const settings = settingsStore.load()
  return {
    settings,
    backupState: backupStateStore.load(),
    destStatus: destinationMonitor.getStatus(),
    libraryStatus: LibraryStatusService.loadCache(),
    exportedCount: readExportedCount(settings.destinationPath),
  }
})

ipcMain.handle('refresh', async () => {
  const settings = settingsStore.load()
  const backupState = backupStateStore.load()
  const fromDate = computeFromDate(settings.fromDatePreset, settings.fromDateCustom)
  destinationMonitor.checkNow()

  if (settings.pythonPath && settings.photosLibraryPath) {
    // Only use lastBackupDate as sinceDate if the destination has an existing export DB.
    // A fresh/changed destination has no DB → treat all items as pending.
    const hasExportDb = dbSize(settings.destinationPath) > 0
    const sinceDate = hasExportDb ? backupState.lastBackupDate : null
    LibraryStatusService.query(settings, sinceDate, fromDate)
      .then((status) => mainWindow?.webContents.send('library-status-updated', status))
      .catch((err) => mainWindow?.webContents.send('library-status-updated', { success: false, error: err.message }))
  }
  return true
})

ipcMain.handle('get-settings', () => settingsStore.load())

ipcMain.handle('save-settings', (_, settings) => {
  settingsStore.save(settings)
  destinationMonitor.stop()
  if (settings.destinationPath) {
    destinationMonitor.start(settings.destinationPath, (status) => {
      mainWindow?.webContents.send('destination-status', status)
    })
  }
  return true
})

ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose Backup Destination',
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('probe-tools', async () => {
  const [probeResult, defaults] = await Promise.all([pathProbe(), Promise.resolve(defaultPaths())])
  return { probe: probeResult, defaults }
})

ipcMain.handle('test-access', async (_, overridePaths) => {
  const settings = settingsStore.load()
  const pythonPath = overridePaths?.pythonPath ?? settings.pythonPath
  const photosLibraryPath = overridePaths?.photosLibraryPath ?? settings.photosLibraryPath
  return LibraryStatusService.testAccess(pythonPath, photosLibraryPath)
})

ipcMain.handle('check-export-db', (_, destinationPath) => {
  return dbSize(destinationPath) > 0
})

ipcMain.handle('start-backup', async (_, opts = {}) => {
  const { dryRun = false } = opts
  const settings = settingsStore.load()
  const state = backupStateStore.load()
  const fromDate = computeFromDate(settings.fromDatePreset, settings.fromDateCustom)

  // Mark running immediately so a crash is detected on next launch (real backups only)
  if (!dryRun) backupStateStore.save({ ...state, outcome: 'running' })

  try {
    const summary = await osxphotosService.runExport({ ...settings, fromDate, dryRun }, (lines) => {
      mainWindow?.webContents.send('backup-log', lines)
    })

    if (!dryRun) {
      const newState = {
        ...backupStateStore.load(),
        lastBackupDate: new Date().toISOString(),
        lastExportedCount: summary.exported + summary.updated,
        lastSummary: {
          processed: summary.processed,
          exported: summary.exported,
          updated: summary.updated,
          skipped: summary.skipped,
        },
        outcome: 'succeeded',
        lastBackupErrorMessage: null,
      }
      backupStateStore.save(newState)
      notificationService.postSuccess(summary)

      // Refresh library status after successful backup
      if (settings.pythonPath && settings.photosLibraryPath) {
        LibraryStatusService.query(settings, newState.lastBackupDate, fromDate)
          .then((status) => mainWindow?.webContents.send('library-status-updated', status))
          .catch(() => {})
      }
    }

    mainWindow?.webContents.send('backup-done', { success: true, summary, dryRun })
  } catch (err) {
    const interrupted = err.message === 'CANCELLED'
    if (!dryRun) {
      backupStateStore.save({
        ...backupStateStore.load(),
        outcome: interrupted ? 'interrupted' : 'failed',
        lastBackupErrorMessage: interrupted ? null : err.message,
      })
      if (interrupted) notificationService.postInterrupted()
      else notificationService.postFailure(err.message)
    }
    mainWindow?.webContents.send('backup-done', { success: false, interrupted, error: err.message, dryRun })
  }
})

ipcMain.handle('cancel-backup', () => {
  osxphotosService.cancel()
  return true
})
