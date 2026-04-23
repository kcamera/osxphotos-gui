import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [settings, setSettings] = useState(null)
  const [backupState, setBackupState] = useState(null)
  const [destStatus, setDestStatus] = useState({ status: 'checking' })
  const [libraryStatus, setLibraryStatus] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [backupPhase, setBackupPhase] = useState('idle') // idle | running | done
  const [backupResult, setBackupResult] = useState(null)

  const loadStatus = useCallback(async () => {
    const data = await window.api.getStatus()
    setSettings(data.settings)
    setBackupState(data.backupState)
    setDestStatus(data.destStatus)
    if (data.libraryStatus) setLibraryStatus(data.libraryStatus)
    setIsLoading(false)
  }, [])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    await loadStatus() // re-sync backupState, settings, destStatus from disk
    await window.api.refresh()
    // library status updates via library-status-updated event
    // We stop the spinner once library status arrives (or after 60s timeout)
    const timeout = setTimeout(() => setIsRefreshing(false), 60_000)
    return () => clearTimeout(timeout)
  }, [loadStatus])

  useEffect(() => {
    loadStatus().then(() => refresh())

    const cleanups = [
      window.api.onDestinationStatus((status) => setDestStatus(status)),
      window.api.onLibraryStatusUpdated((status) => {
        if (status.success) setLibraryStatus(status)
        setIsRefreshing(false)
      }),
    ]

    return () => cleanups.forEach((fn) => fn())
  }, [loadStatus, refresh])

  const updateSettings = useCallback(async (newSettings) => {
    await window.api.saveSettings(newSettings)
    setSettings(newSettings)
  }, [])

  const updateBackupState = useCallback((updates) => {
    setBackupState((prev) => ({ ...prev, ...updates }))
  }, [])

  return (
    <AppContext.Provider value={{
      settings, setSettings,
      backupState, updateBackupState,
      destStatus,
      libraryStatus,
      isLoading,
      isRefreshing,
      backupPhase, setBackupPhase,
      backupResult, setBackupResult,
      refresh,
      loadStatus,
      updateSettings,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppStore() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppStore must be used inside AppProvider')
  return ctx
}
