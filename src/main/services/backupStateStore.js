import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const DEFAULTS = {
  schemaVersion: 1,
  lastBackupDate: null,
  lastBackupPhotoCount: 0,
  lastExportedCount: 0,
  lastSummary: null, // { processed, exported, updated, skipped }
  outcome: 'never', // 'never' | 'succeeded' | 'failed' | 'interrupted' | 'running'
  lastBackupErrorMessage: null,
}

function filePath() {
  return join(app.getPath('userData'), 'backup_state.json')
}

export const backupStateStore = {
  load() {
    try {
      const raw = readFileSync(filePath(), 'utf8')
      const parsed = JSON.parse(raw)
      // Handle missing schemaVersion (backward compat)
      return { ...DEFAULTS, ...parsed, schemaVersion: 1 }
    } catch {
      return { ...DEFAULTS }
    }
  },
  save(state) {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(filePath(), JSON.stringify({ ...DEFAULTS, ...state, schemaVersion: 1 }, null, 2))
  },
}
