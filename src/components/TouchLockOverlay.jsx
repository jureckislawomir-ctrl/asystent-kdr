import { useEffect, useRef, useState } from 'react'
import { Lock } from 'lucide-react'

const HOLD_MS = 1000 // tyle trzeba przytrzymać, aby odblokować

// Blokada dotyku: przezroczysta warstwa nad całą aplikacją. Treść nadal widoczna i aktualna,
// ale żadne przypadkowe dotknięcie nic nie zmieni. Odblokowanie tylko przez przytrzymanie.
export default function TouchLockOverlay({ onUnlock }) {
  const [progress, setProgress] = useState(0)
  const raf = useRef(0)
  const start = useRef(null)

  const cancel = () => {
    cancelAnimationFrame(raf.current)
    start.current = null
    setProgress(0)
  }

  const tick = () => {
    if (start.current === null) return
    const p = Math.min(1, (performance.now() - start.current) / HOLD_MS)
    setProgress(p)
    if (p >= 1) {
      start.current = null
      navigator.vibrate?.(60)
      onUnlock()
    } else {
      raf.current = requestAnimationFrame(tick)
    }
  }

  const begin = (e) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId) // lekki ruch palca w rękawicy nie przerywa
    start.current = performance.now()
    raf.current = requestAnimationFrame(tick)
  }

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <div
      role="dialog"
      aria-label="Ekran zablokowany"
      className="fixed inset-0 z-50 touch-none select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* wyraźna ramka: widać od razu, że ekran jest zablokowany */}
      <div className="pointer-events-none absolute inset-0 border-8 border-accent" />

      <div className="absolute inset-x-0 bottom-0 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onPointerDown={begin}
          onPointerUp={cancel}
          onPointerCancel={cancel}
          className="relative flex min-h-20 w-full max-w-md flex-col items-center justify-center overflow-hidden rounded-lg border-4 border-accent bg-bg px-4 text-fg"
        >
          <span className="flex items-center gap-3 text-xl font-black">
            <Lock size={30} /> ZABLOKOWANE
          </span>
          <span className="text-base font-bold text-muted">Przytrzymaj, aby odblokować</span>
          <span className="absolute inset-x-0 bottom-0 h-2 bg-surface">
            <span className="block h-full bg-accent" style={{ width: `${progress * 100}%` }} />
          </span>
        </button>
      </div>
    </div>
  )
}
