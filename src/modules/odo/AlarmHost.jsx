import { useEffect, useRef } from 'react'
import { BellRing } from 'lucide-react'
import { useOdo } from './OdoContext'
import { nextCheckDue, fmtDuration } from './logic'
import { snoozeCheck } from './db'
import { beep, audioReady, unlockAudio } from './audio'
import { useClock } from '../../hooks/useClock'

// Alarm kontroli ciśnienia – działa w każdym module i NAD blokadą dotyku.
// Jak minutnik na tablicy: po upływie czasu sygnał, po 10 s głośniej. Do tego wibracja i pełny ekran.
export default function AlarmHost({ onUnlock, onNavigate }) {
  const { rotas, settings, dialog, open } = useOdo()
  const now = useClock().getTime()

  const due = rotas
    .map((r) => ({ rota: r, due: nextCheckDue(r, settings.intervalMin) }))
    .filter((x) => x.due !== null && now >= x.due && dialog?.rotaId !== x.rota.id)

  const active = due.length > 0
  useAlarmSignal(active)
  useBackgroundNotification(due)

  if (!active) return null

  const enterCheck = (rotaId) => {
    onUnlock()
    onNavigate('odo')
    open('check', { rotaId })
  }

  // Gdy KDR właśnie coś wpisuje (otwarte okno) – pasek na górze, żeby nie przerywać wpisu
  if (dialog) {
    return (
      <div role="alert" className="fixed inset-x-0 top-0 z-[60] flex flex-wrap items-center gap-3 border-b-4 border-alarm bg-bg px-3 py-2">
        <BellRing size={32} className="text-alarm" />
        <span className="mr-auto text-xl font-black text-alarm">
          KONTROLA CIŚNIENIA: {due.map(({ rota }) => rota.label).join(', ')}
        </span>
        <span className="text-sm text-muted">Dokończ bieżący wpis – alarm wróci na pełny ekran.</span>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-black/80 p-4" role="alertdialog" aria-label="Alarm kontroli ciśnienia">
      <div className="pointer-events-none absolute inset-0 border-[12px] border-alarm" />
      <div className="flex w-full max-w-3xl flex-col gap-4 rounded-xl border-4 border-alarm bg-bg p-5">
        <p className="flex items-center gap-3 text-4xl font-black text-alarm">
          <BellRing size={48} /> KONTROLA CIŚNIENIA
        </p>
        {!audioReady() && (
          <button
            type="button"
            onClick={() => (unlockAudio(), setTimeout(() => beep(1), 50))}
            className="min-h-14 rounded-lg border-2 border-warn px-4 text-lg font-bold text-warn"
          >
            Dźwięk wyłączony przez przeglądarkę – dotknij, aby włączyć sygnał
          </button>
        )}
        {due.map(({ rota, due: at }) => (
          <div key={rota.id} className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-line p-3">
            <span className="mr-auto flex flex-col">
              <span className="text-3xl font-black">{rota.label}</span>
              <span className="text-lg text-muted">
                {rota.members.filter(Boolean).join(', ') || 'ratownicy'} · po terminie{' '}
                <span className="tabular font-bold text-alarm">+{fmtDuration(now - at)}</span>
              </span>
            </span>
            <button
              type="button"
              onClick={() => snoozeCheck(rota.id, 1)}
              className="min-h-16 rounded-lg border-2 border-line px-4 text-lg font-bold active:bg-fg active:text-bg"
            >
              Odłóż 1 min
            </button>
            <button
              type="button"
              onClick={() => enterCheck(rota.id)}
              className="min-h-16 rounded-lg border-2 border-accent bg-accent px-5 text-xl font-black text-accent-fg active:bg-fg active:text-bg"
            >
              WPISZ KONTROLĘ
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function useAlarmSignal(active) {
  useEffect(() => {
    if (!active) return
    const start = Date.now()
    const ring = () => {
      const loud = Date.now() - start > 10_000 // jak na tablicy: po 10 s głośniej
      beep(loud ? 1 : 0.35)
      try {
        navigator.vibrate?.(loud ? [500, 150, 500, 150, 500] : [300, 200, 300])
      } catch {
        /* ignoruj */
      }
    }
    ring()
    const t = setInterval(ring, 1500)
    return () => {
      clearInterval(t)
      try {
        navigator.vibrate?.(0)
      } catch {
        /* ignoruj */
      }
    }
  }, [active])
}

// Gdy aplikacja jest w tle (inna aplikacja, zgaszony ekran) – powiadomienie systemowe.
function useBackgroundNotification(due) {
  const sent = useRef(new Set())
  useEffect(() => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    for (const { rota, due: at } of due) {
      const key = `${rota.id}:${at}`
      if (sent.current.has(key) || document.visibilityState === 'visible') continue
      sent.current.add(key)
      navigator.serviceWorker?.ready
        .then((reg) =>
          reg.showNotification('KONTROLA CIŚNIENIA', {
            body: `${rota.label} – czas na kontrolę ciśnienia`,
            tag: `odo-${rota.id}`,
            renotify: true,
            requireInteraction: true,
            vibrate: [500, 150, 500, 150, 500],
            icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
          }),
        )
        .catch(() => {})
    }
  }, [due])
}
