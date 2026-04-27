import { spawn } from 'child_process'
import { readFileSync, writeFileSync, appendFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const RICH_RE = /\[\/?\w[^\]]*\]/g

function stripRich(line) {
  return line.replace(RICH_RE, '').trim()
}

function parseReportFile(reportPath) {
  try {
    const raw = JSON.parse(readFileSync(reportPath, 'utf8'))
    // osxphotos report is an array of per-photo objects
    if (Array.isArray(raw)) {
      const summary = { processed: raw.length, exported: 0, updated: 0, skipped: 0, missing: 0, errors: 0 }
      for (const item of raw) {
        if (item.exported && !item.skipped) {
          if (item.new) summary.exported++
          else summary.updated++
        } else if (item.skipped) {
          summary.skipped++
        }
        if (item.missing) summary.missing++
        if (item.error) summary.errors++
      }
      return summary
    }
    // Some versions emit a summary object directly
    if (raw && typeof raw === 'object' && 'exported' in raw) {
      return {
        processed: raw.processed ?? 0,
        exported: raw.exported ?? 0,
        updated: raw.updated ?? 0,
        skipped: raw.skipped ?? 0,
        missing: raw.missing ?? 0,
        errors: raw.error ?? 0,
      }
    }
  } catch { /* fall through */ }
  return null
}

function parseSummaryLine(lines) {
  // "Processed: 44030 photo(s), exported: 47, updated: 3, skipped: 43980, missing: 8241, error: 0"
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]
    if (!line.includes('Processed:')) continue
    const num = (key) => {
      const m = line.match(new RegExp(`${key}:\\s*(\\d+)`))
      return m ? parseInt(m[1], 10) : 0
    }
    return {
      processed: num('Processed'),
      exported: num('exported'),
      updated: num('updated'),
      skipped: num('skipped'),
      missing: num('missing'),
      errors: num('error'),
    }
  }
  return null
}

export class OsxphotosService {
  constructor() {
    this._proc = null
    this._cancelled = false
  }

  async runExport(settings, onLine) {
    const { osxphotosPath, destinationPath, photosLibraryPath, fromDate, dryRun = false, disableDownloadMissing = false } = settings

    // Capture start time for log filename and header
    const startTime = Date.now()
    const startDate = new Date(startTime)
    const p = (n) => String(n).padStart(2, '0')
    const Y = startDate.getFullYear(), M = p(startDate.getMonth() + 1), D = p(startDate.getDate())
    const h = p(startDate.getHours()), m = p(startDate.getMinutes()), s = p(startDate.getSeconds())
    const startTag = `${Y}-${M}-${D}_${h}-${m}-${s}` // 2026-04-23_08-43-49 (local time)
    const startIso = `${Y}-${M}-${D} ${h}:${m}:${s}` // 2026-04-23 08:43:49 (local time)

    const reportPath = join(tmpdir(), `osxphotos_report_${Date.now()}.json`)
    const logPath = dryRun ? null : join(destinationPath, `osxphotos_backup_${startTag}.log`)

    const args = [
      'export', destinationPath,
      '--update',
      '--not-shared',
      '--not-shared-library',
      '--export-aae',
      '--sidecar', 'xmp',
      '--touch-file',
      '--filename', 'IMG_{created.date}_{created.hour}-{created.min}-{created.sec}_{uuid|chop(28)}',
      '--directory', '{created.year}',
      '--report', reportPath,
      '--no-progress',
      '--verbose',
    ]
    if (fromDate) args.push('--from-date', fromDate)
    if (!disableDownloadMissing) args.push('--download-missing', '--retry', '3')
    if (dryRun) args.push('--dry-run')

    this._cancelled = false

    // Write log header immediately so the file exists and is searchable from the start
    if (logPath) {
      try {
        writeFileSync(logPath, [
          'OSXPhotos Backup Log',
          '====================',
          `Started:     ${startIso}`,
          `Library:     ${photosLibraryPath ?? '(unknown)'}`,
          `Destination: ${destinationPath}`,
          `From date:   ${fromDate ?? 'all time'}`,
          '',
          '--- osxphotos output ---',
          '',
        ].join('\n'))
      } catch { /* don't fail if header write fails */ }
    }

    // Batch log lines: flush every 100ms or 50 lines (UI and log file together)
    let batch = []
    let batchTimer = null
    const flush = () => {
      if (batch.length) {
        onLine([...batch])
        if (logPath) {
          try { appendFileSync(logPath, batch.join('\n') + '\n') } catch {}
        }
        batch = []
      }
      batchTimer = null
    }
    const queue = (line) => {
      batch.push(line)
      if (batch.length >= 50) { clearTimeout(batchTimer); flush() }
      else if (!batchTimer) batchTimer = setTimeout(flush, 100)
    }

    const allLines = [] // retained for parseSummaryLine at end

    return new Promise((resolve, reject) => {
      this._proc = spawn(osxphotosPath, args)

      const handleLine = (line) => {
        const stripped = stripRich(line)
        if (!stripped) return
        allLines.push(stripped)
        queue(stripped)
      }

      let outBuf = ''
      this._proc.stdout.on('data', (d) => {
        outBuf += d.toString()
        const parts = outBuf.split('\n')
        outBuf = parts.pop()
        parts.forEach(handleLine)
      })
      this._proc.stderr.on('data', (d) => {
        d.toString().split('\n').filter(Boolean).forEach(handleLine)
      })

      this._proc.on('close', (code) => {
        clearTimeout(batchTimer)
        if (outBuf.trim()) handleLine(outBuf)
        flush()
        this._proc = null

        // Compute elapsed time
        const elapsedSec = Math.floor((Date.now() - startTime) / 1000)
        const hh = String(Math.floor(elapsedSec / 3600)).padStart(2, '0')
        const mm = String(Math.floor((elapsedSec % 3600) / 60)).padStart(2, '0')
        const ss = String(elapsedSec % 60).padStart(2, '0')
        const elapsed = `${hh}:${mm}:${ss}`

        const appendFooter = (outcome, summary) => {
          if (!logPath) return
          try {
            const foot = [
              '',
              '--- Summary ---',
              ...(summary ? [
                `Exported:    ${summary.exported} new`,
                `Updated:     ${summary.updated}`,
                `Skipped:     ${summary.skipped}`,
                `Missing:     ${summary.missing}`,
                `Errors:      ${summary.errors}`,
              ] : []),
              `Outcome:     ${outcome}`,
              `Elapsed:     ${elapsed}`,
              '',
            ]
            appendFileSync(logPath, foot.join('\n'))
          } catch { /* don't fail the backup if footer write fails */ }
        }

        if (this._cancelled) {
          appendFooter('stopped', null)
          try { if (existsSync(reportPath)) unlinkSync(reportPath) } catch { /* ok */ }
          return reject(new Error('CANCELLED'))
        }

        // Prefer osxphotos's own summary line (counts photos, not sidecars/touch ops).
        // Fall back to report file parsing if the summary line isn't found.
        let summary = parseSummaryLine(allLines)
        if (!summary) summary = parseReportFile(reportPath)
        if (!summary) summary = { processed: 0, exported: 0, updated: 0, skipped: 0, missing: 0, errors: 0 }

        try { if (existsSync(reportPath)) unlinkSync(reportPath) } catch { /* ok */ }

        if (code !== 0 && !summary.processed) {
          appendFooter('failed', null)
          return reject(new Error(`osxphotos exited with code ${code}`))
        }

        appendFooter('succeeded', summary)
        resolve(summary)
      })

      this._proc.on('error', (err) => {
        clearTimeout(batchTimer)
        this._proc = null
        reject(new Error(`Failed to start osxphotos: ${err.message}`))
      })
    })
  }

  cancel() {
    if (this._proc) {
      this._cancelled = true
      this._proc.kill('SIGTERM')
    }
  }
}
