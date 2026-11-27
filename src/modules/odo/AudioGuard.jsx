import { VolumeX } from 'lucide-react'
import { useOdo } from './OdoContext'
import { ACTIVE_STATUSES, nextCheckDue } from './logic'
import { audioReady, unlockAudio, beep } from './audio'
import { useClock } from '../../hooks/useClock'

// Gdy przeglądarka zablokuje dźwięk (zwykle po odświeżeniu w karcie Chrome):
// - na co dzień mały pasek – znika po DOWOLNYM dotknięciu ekranu,
// - duży czerwony, gdy do kontroli którejś roty zostało < 60 s albo kontrola jest po terminie.
export default function AudioGuard() {
  const now = useClock().getTime() // odświeżanie co sekundę
  const { rotas, settings } = useOdo()
  const active = rotas.filter((r) => ACTIVE_STATUSES.includes(r.status))
  if (!active.length || audioReady()) return null

  const soon = active.some((r) => {
    const due = nextCheckDue(r, settings.intervalMin)
    return due !== null && due - now < 60_000
  })
  const enable = () => (unlockAudio(), setTimeout(() => beep(0.6), 50))

  if (!soon)
    return (
      <button
        type="button"
        onClick={enable}
        className="no-print flex min-h-12 w-full items-center justify-center gap-2 border-b-2 border-warn bg-surface px-3 text-base font-bold text-warn"
      >
        <VolumeX size={20} /> Dźwięk wyłączony przez przeglądarkę – dotknij ekranu w dowolnym miejscu, aby włączyć
      </button>
    )

  return (
    <button
      type="button"
      onClick={enable}
      className="no-print flex min-h-16 w-full items-center justify-center gap-3 border-b-4 border-alarm bg-surface px-3 text-xl font-black text-alarm"
    >
      <VolumeX size={30} /> DŹWIĘK ALARMÓW WYŁĄCZONY – zbliża się kontrola. Dotknij ekranu, aby włączyć
    </button>
  )
}
