import { statSync, statfsSync, existsSync } from 'fs'

const POLL_INTERVAL_MS = 30_000

export class DestinationMonitor {
  constructor() {
    this._timer = null
    this._status = { status: 'pathNotConfigured' }
    this._callback = null
    this._destinationPath = null
  }

  start(destinationPath, callback) {
    this._destinationPath = destinationPath
    this._callback = callback
    this._check()
    this._timer = setInterval(() => this._check(), POLL_INTERVAL_MS)
  }

  stop() {
    if (this._timer) {
      clearInterval(this._timer)
      this._timer = null
    }
    this._status = { status: 'pathNotConfigured' }
  }

  getStatus() {
    return this._status
  }

  checkNow() {
    this._check()
    return this._status
  }

  _check() {
    if (!this._destinationPath) {
      this._update({ status: 'pathNotConfigured' })
      return
    }
    try {
      statSync(this._destinationPath)
      let freeBytes = 0
      let totalBytes = 0
      try {
        const fs = statfsSync(this._destinationPath)
        freeBytes = fs.bfree * fs.bsize
        totalBytes = fs.blocks * fs.bsize
      } catch {
        // statfsSync not available in this Node version; leave as 0
      }
      this._update({ status: 'available', freeBytes, totalBytes, backupDirBytes: 0 })
    } catch (err) {
      const code = err.code ?? ''
      if (['ENOENT', 'EHOSTDOWN', 'EHOSTUNREACH', 'ETIMEDOUT', 'ECONNREFUSED', 'EIO'].includes(code)) {
        this._update({ status: 'unavailable' })
      } else {
        this._update({ status: 'unavailable' })
      }
    }
  }

  _update(status) {
    this._status = status
    this._callback?.(status)
  }

  // Called after a successful backup to update backupDirBytes from report data
  updateBackupDirBytes(bytes) {
    if (this._status.status === 'available') {
      this._status = { ...this._status, backupDirBytes: bytes }
    }
  }
}
