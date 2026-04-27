import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const DEFAULTS = {
  destinationPath: '',
  osxphotosPath: '',
  pythonPath: '',
  photosLibraryPath: '',
  disableDownloadMissing: false,  // override: skip iCloud downloads (use when local storage can't accommodate)
  fromDatePreset: 'all',   // 'all' | '1yr' | '2yr' | '5yr' | 'custom'
  fromDateCustom: '',       // YYYY-MM-DD when preset is 'custom'
}

function settingsPath() {
  return join(app.getPath('userData'), 'settings.json')
}

export const settingsStore = {
  load() {
    try {
      const raw = readFileSync(settingsPath(), 'utf8')
      return { ...DEFAULTS, ...JSON.parse(raw) }
    } catch {
      return { ...DEFAULTS }
    }
  },
  save(settings) {
    const dir = app.getPath('userData')
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(settingsPath(), JSON.stringify({ ...DEFAULTS, ...settings }, null, 2))
  },
}
