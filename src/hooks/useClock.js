import { useEffect, useState } from 'react'

// Zegar odświeżany co sekundę, wyrównany do pełnej sekundy
export function useClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer
    const tick = () => {
      setNow(new Date())
      timer = setTimeout(tick, 1000 - (Date.now() % 1000))
    }
    timer = setTimeout(tick, 1000 - (Date.now() % 1000))
    return () => clearTimeout(timer)
  }, [])

  return now
}

export const fmtTime = (d) => d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
export const fmtDate = (d) => {
  const s = d.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1) // „Czwartek, 26 listopada 2026”
}
