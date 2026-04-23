import { useState } from 'react'
import { AppProvider, useAppStore } from './store/appStore.jsx'
import DashboardView from './views/DashboardView.jsx'
import SetupView from './views/SetupView.jsx'
import SettingsView from './views/SettingsView.jsx'

function AppInner() {
  const { settings, isLoading } = useAppStore()
  const [showSettings, setShowSettings] = useState(false)

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="spinner" style={{ width: 24, height: 24 }} />
      </div>
    )
  }

  if (!settings?.destinationPath) {
    return <SetupView onComplete={() => setShowSettings(false)} />
  }

  return (
    <>
      <DashboardView onOpenSettings={() => setShowSettings(true)} />
      {showSettings && <SettingsView onClose={() => setShowSettings(false)} />}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  )
}
