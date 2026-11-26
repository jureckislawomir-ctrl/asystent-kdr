import { VolumeX } from 'lucide-react'
import { useOdo } from './OdoContext'
import { ACTIVE_STATUSES } from './logic'
import { audioReady, unlockAudio, beep } from './audio'
import { useClock } from '../../hooks/useClock'

// Po zamknięciu aplikacji („Zamknij wszystko”) przeglądarka blokuje dźwięk do pierwszego dotknięcia.
// Gdy w strefie są roty, a dźwięk jest zablokowany – wyraźny pasek na górze ekranu.
export default function AudioGuard() {
  useClock() // odświeżanie co sekundę, żeby pasek zniknął zaraz po odblokowaniu
  const { rotas } = useOdo()
  const inZone = rotas.some((r) => ACTIVE_STATUSES.includes(r.status))
  if (!inZone || audioReady()) return null
  return (
    <button
      type="button"
      onClick={() => (unlockAudio(), setTimeout(() => beep(0.6), 50))}
      className="no-print flex min-h-16 w-full items-center justify-center gap-3 border-b-4 border-alarm bg-surface px-3 text-xl font-black text-alarm"
    >
      <VolumeX size={30} /> DŹWIĘK ALARMÓW WYŁĄCZONY – dotknij tutaj, aby włączyć
    </button>
  )
}
