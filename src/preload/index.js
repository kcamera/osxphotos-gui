import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Status & data
  getStatus: () => ipcRenderer.invoke('get-status'),
  refresh: () => ipcRenderer.invoke('refresh'),

  // Backup lifecycle
  startBackup: () => ipcRenderer.invoke('start-backup'),
  cancelBackup: () => ipcRenderer.invoke('cancel-backup'),

  // Streaming events — return cleanup functions
  onBackupLog: (cb) => {
    const handler = (_, lines) => cb(lines)
    ipcRenderer.on('backup-log', handler)
    return () => ipcRenderer.removeListener('backup-log', handler)
  },
  onBackupDone: (cb) => {
    const handler = (_, result) => cb(result)
    ipcRenderer.on('backup-done', handler)
    return () => ipcRenderer.removeListener('backup-done', handler)
  },
  onDestinationStatus: (cb) => {
    const handler = (_, status) => cb(status)
    ipcRenderer.on('destination-status', handler)
    return () => ipcRenderer.removeListener('destination-status', handler)
  },
  onLibraryStatusUpdated: (cb) => {
    const handler = (_, status) => cb(status)
    ipcRenderer.on('library-status-updated', handler)
    return () => ipcRenderer.removeListener('library-status-updated', handler)
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  probeTools: () => ipcRenderer.invoke('probe-tools'),
  testAccess: (overridePaths) => ipcRenderer.invoke('test-access', overridePaths),
  checkExportDb: (destinationPath) => ipcRenderer.invoke('check-export-db', destinationPath),
})
