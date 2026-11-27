import { useEffect, useRef, useState } from 'react'
import { TriangleAlert } from 'lucide-react'
import TopBar from './components/TopBar'
import NavBar from './components/NavBar'
import UpdateBanner from './components/UpdateBanner'
import TouchLockOverlay from './components/TouchLockOverlay'
import Pulpit from './modules/pulpit/Pulpit'
import ModulePlaceholder from './modules/_placeholder/ModulePlaceholder'
import OdoModule from './modules/odo/OdoModule'
import AlarmHost from './modules/odo/AlarmHost'
import AudioGuard from './modules/odo/AudioGuard'
import { OdoProvider, useOdo } from './modules/odo/OdoContext'
import { DialogHost } from './modules/odo/dialogs'
import { unlockAudio, initAudio, UNLOCK_EVENTS } from './modules/odo/audio'
import { MODULES } from './config/modules'
import { useTheme } from './hooks/useTheme'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { useWakeLock } from './hooks/useWakeLock'
import { useStoragePersistence } from './hooks/useStoragePersistence'
import { useHashRoute } from './hooks/useHashRoute'
import { usePwa } from './hooks/usePwa'
import { useBattery } from './hooks/useBattery'

export default function App() {
  return (
    <OdoProvider>
      <Shell />
    </OdoProvider>
  )
}

function Shell() {
  const { theme, toggle } = useTheme()
  const online = useOnlineStatus()
  const wakeLock = useWakeLock()
  const storage = useStoragePersistence()
  const pwa = usePwa()
  const battery = useBattery()
  const [route, navigate] = useHashRoute()
  const mainRef = useRef(null)
  const [locked, setLocked] = useState(false)

  // Dźwięk alarmu wymaga gestu użytkownika (oderwanie palca) – odblokowujemy przy każdym geście
  useEffect(() => {
    const stopInit = initAudio() // zainstalowana aplikacja może grać od razu, bez dotknięcia
    UNLOCK_EVENTS.forEach((ev) => document.addEventListener(ev, unlockAudio, { capture: true, passive: true }))
    return () => {
      stopInit()
      UNLOCK_EVENTS.forEach((ev) => document.removeEventListener(ev, unlockAudio, { capture: true }))
    }
  }, [])

  // Przy blokadzie przycisk „Wstecz” Androida też nie zmienia zakładki
  useEffect(() => {
    if (!locked) return
    const stay = () => window.history.go(1)
    window.addEventListener('popstate', stay)
    return () => window.removeEventListener('popstate', stay)
  }, [locked])

  const lock = () => {
    navigator.vibrate?.(40)
    setLocked(true)
  }

  // po zmianie zakładki zawsze od góry
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [route])

  const module = MODULES.find((m) => m.id === route)

  return (
    <div className="flex h-full flex-col">
      <TopBar theme={theme} onToggleTheme={toggle} online={online} wakeLock={wakeLock} pwa={pwa} storage={storage} battery={battery} onLock={lock} />
      {pwa.needRefresh && <UpdateBanner onUpdate={pwa.applyUpdate} onLater={pwa.postponeUpdate} />}
      <DbGuard />
      <AppErrorBanner />
      <StorageErrorBanner />
      <BatteryBanner battery={battery} />
      <AudioGuard />

      <div className="flex min-h-0 flex-1 flex-col landscape:flex-row">
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
          {route === 'pulpit' && <Pulpit onNavigate={navigate} pwa={pwa} storage={storage} wakeLock={wakeLock} />}
          {route === 'odo' && <OdoModule />}
          {route !== 'pulpit' && route !== 'odo' && <ModulePlaceholder module={module} onNavigate={navigate} />}
        </main>
        <NavBar route={route} onNavigate={navigate} />
      </div>

      <DialogHost />
      {locked && <TouchLockOverlay onUnlock={() => setLocked(false)} />}
      <AlarmHost onUnlock={() => setLocked(false)} onNavigate={navigate} />
    </div>
  )
}

// Każdy nieobsłużony błąd – widoczny na ekranie (diagnostyka na tablecie bez komputera)
function AppErrorBanner() {
  const [errs, setErrs] = useState([])
  useEffect(() => {
    const add = (msg) => setErrs((e) => [...e.slice(-2), `${new Date().toLocaleTimeString('pl-PL')} ${msg}`])
    const onErr = (e) => add(e?.message || String(e?.error || 'nieznany błąd'))
    const onRej = (e) => add(e?.reason?.message || String(e?.reason || 'nieznany błąd'))
    window.addEventListener('error', onErr)
    window.addEventListener('unhandledrejection', onRej)
    return () => {
      window.removeEventListener('error', onErr)
      window.removeEventListener('unhandledrejection', onRej)
    }
  }, [])
  if (!errs.length) return null
  return (
    <div role="alert" className="no-print flex flex-wrap items-center gap-3 border-b-4 border-alarm bg-surface px-3 py-2 text-alarm">
      <TriangleAlert size={26} />
      <div className="mr-auto text-sm font-bold">
        <p className="text-base font-black">BŁĄD APLIKACJI – zrób zrzut ekranu i prześlij:</p>
        {errs.map((m, i) => (
          <p key={i} className="tabular">{m}</p>
        ))}
      </div>
      <button type="button" onClick={() => setErrs([])} className="min-h-14 rounded-lg border-2 border-alarm px-4 font-bold">
        Zamknij
      </button>
    </div>
  )
}

// Baza nie odpowiada / aplikacja otwarta w dwóch oknach – wyraźnie, z instrukcją
function DbGuard() {
  const { dbStatus, otherWindow, recheckDb } = useOdo()
  if (!dbStatus.ok)
    return (
      <div role="alert" className="no-print flex flex-wrap items-center gap-3 border-b-4 border-alarm bg-surface px-3 py-2 text-alarm">
        <TriangleAlert size={28} />
        <div className="mr-auto">
          <p className="text-lg font-black">BAZA DANYCH NIE ODPOWIADA – zapis rot jest niemożliwy.</p>
          <p className="font-bold">
            1) Zamknij inne okna aplikacji (karta w Chrome, druga ikona). 2) Jeśli nie pomoże – uruchom ponownie tablet. Do tego czasu prowadź tablicę papierową.
          </p>
        </div>
        <button type="button" onClick={recheckDb} className="min-h-14 rounded-lg border-2 border-alarm px-4 font-bold">
          Sprawdź ponownie
        </button>
      </div>
    )
  if (otherWindow)
    return (
      <div role="alert" className="no-print flex flex-wrap items-center gap-3 border-b-4 border-warn bg-surface px-3 py-2 text-warn">
        <TriangleAlert size={26} />
        <p className="mr-auto text-base font-black">
          Aplikacja jest otwarta także w innym oknie (np. karta w Chrome). Zamknij jedno z nich – dwa okna mogą zablokować zapis.
        </p>
      </div>
    )
  return null
}

// Bateria ≤ 15% bez ładowania – czerwony pasek; „Rozumiem” ukrywa go do kolejnego spadku o 5%
function BatteryBanner({ battery }) {
  const [hiddenAt, setHiddenAt] = useState(null)
  if (!battery.critical) return null
  if (hiddenAt !== null && battery.level > hiddenAt - 5) return null
  return (
    <div role="alert" className="no-print flex flex-wrap items-center gap-3 border-b-4 border-alarm bg-surface px-3 py-2 text-alarm">
      <TriangleAlert size={28} />
      <p className="mr-auto text-lg font-black">BATERIA TABLETU {battery.level}% – PODŁĄCZ ŁADOWARKĘ.</p>
      <button type="button" onClick={() => setHiddenAt(battery.level)} className="min-h-14 rounded-lg border-2 border-alarm px-4 font-bold">
        Rozumiem
      </button>
    </div>
  )
}

// Błąd zapisu danych – zawsze głośno, nigdy po cichu
function StorageErrorBanner() {
  const { storageError, clearStorageError } = useOdo()
  if (!storageError) return null
  return (
    <div role="alert" className="no-print flex flex-wrap items-center gap-3 border-b-4 border-alarm bg-surface px-3 py-2 text-alarm">
      <TriangleAlert size={28} />
      <p className="mr-auto text-lg font-black">
        BŁĄD ZAPISU DANYCH – ostatni wpis mógł nie zostać zapisany. Prowadź równolegle tablicę papierową.
      </p>
      <button type="button" onClick={clearStorageError} className="min-h-14 rounded-lg border-2 border-alarm px-4 font-bold">
        Rozumiem
      </button>
    </div>
  )
}
