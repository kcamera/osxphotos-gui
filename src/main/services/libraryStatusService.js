import { spawn } from 'child_process'
import { app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const CACHE_FILE = 'library_status_cache.json'
const TIMEOUT_MS = 60_000

function cachePath() {
  return join(app.getPath('userData'), CACHE_FILE)
}

function getScriptPath() {
  return app.isPackaged
    ? join(process.resourcesPath, 'query_status.py')
    : join(process.env.APP_ROOT ?? process.cwd(), 'src/resources/query_status.py')
}

export const LibraryStatusService = {
  loadCache() {
    try {
      return JSON.parse(readFileSync(cachePath(), 'utf8'))
    } catch {
      return null
    }
  },

  saveCache(status) {
    try {
      const dir = app.getPath('userData')
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      writeFileSync(cachePath(), JSON.stringify(status, null, 2))
    } catch { /* non-fatal */ }
  },

  async query(settings, sinceDate, fromDate) {
    const { pythonPath, photosLibraryPath } = settings
    if (!pythonPath || !photosLibraryPath) {
      throw new Error('Python path or Photos library path not configured')
    }

    const scriptPath = getScriptPath()
    const args = [scriptPath, '--library', photosLibraryPath]
    if (sinceDate) args.push('--since', sinceDate)
    if (fromDate) args.push('--from-date', fromDate)

    return new Promise((resolve, reject) => {
      let stdout = ''
      let stderr = ''
      const proc = spawn(pythonPath, args)
      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error('Status query timed out after 60s'))
      }, TIMEOUT_MS)

      proc.stdout.on('data', (d) => { stdout += d.toString() })
      proc.stderr.on('data', (d) => { stderr += d.toString() })

      proc.on('close', (code) => {
        clearTimeout(timer)
        try {
          const result = JSON.parse(stdout.trim())
          if (result.success) {
            LibraryStatusService.saveCache(result)
            resolve(result)
          } else {
            reject(new Error(result.error ?? 'query_status.py returned failure'))
          }
        } catch {
          reject(new Error(`Failed to parse output: ${stdout || stderr}`))
        }
      })

      proc.on('error', (err) => {
        clearTimeout(timer)
        reject(new Error(`Failed to start Python: ${err.message}`))
      })
    })
  },

  async testAccess(pythonPath, photosLibraryPath) {
    if (!pythonPath || !photosLibraryPath) {
      return { ok: false, error: 'Python path or library path not configured' }
    }
    const scriptPath = getScriptPath()
    return new Promise((resolve) => {
      const proc = spawn(pythonPath, [scriptPath, '--library', photosLibraryPath, '--test-only'])
      let stdout = ''
      let stderr = ''
      const timer = setTimeout(() => {
        proc.kill()
        resolve({ ok: false, error: 'Timed out (10s) — Full Disk Access may not be granted' })
      }, 10_000)

      proc.stdout.on('data', (d) => { stdout += d.toString() })
      proc.stderr.on('data', (d) => { stderr += d.toString() })
      proc.on('close', (code) => {
        clearTimeout(timer)
        try {
          const result = JSON.parse(stdout.trim())
          resolve({ ok: result.success, error: result.error ?? null })
        } catch {
          resolve({ ok: false, error: stderr || stdout || 'Unknown error' })
        }
      })
      proc.on('error', (err) => {
        clearTimeout(timer)
        resolve({ ok: false, error: err.message })
      })
    })
  },
}
