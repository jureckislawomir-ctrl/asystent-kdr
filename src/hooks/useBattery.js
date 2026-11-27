import { useEffect, useState } from 'react'

// Progi ostrzeżeń (tablet bez ładowarki): ≤ 30% – wskaźnik w nagłówku, ≤ 15% – czerwony pasek.
export const BATTERY_WARN = 30
export const BATTERY_CRITICAL = 15

/** Stan baterii tabletu (Battery Status API – Chrome na Androidzie). supported=false, gdy przeglądarka go nie udostępnia. */
export function useBattery() {
  const [st, setSt] = useState({ supported: !!navigator.getBattery, level: null, charging: null })
  useEffect(() => {
    if (!navigator.getBattery) return
    let bat
    let alive = true
    const read = () => alive && setSt({ supported: true, level: Math.round(bat.level * 100), charging: bat.charging })
    navigator
      .getBattery()
      .then((b) => {
        bat = b
        read()
        b.addEventListener('levelchange', read)
        b.addEventListener('chargingchange', read)
      })
      .catch(() => alive && setSt({ supported: false, level: null, charging: null }))
    return () => {
      alive = false
      bat?.removeEventListener('levelchange', read)
      bat?.removeEventListener('chargingchange', read)
    }
  }, [])
  const known = st.level !== null
  return {
    ...st,
    low: known && !st.charging && st.level <= BATTERY_WARN,
    critical: known && !st.charging && st.level <= BATTERY_CRITICAL,
  }
}

export function batteryText(b) {
  if (!b.supported) return 'bateria: brak danych'
  if (b.level === null) return 'bateria: …'
  return `bateria ${b.level}%${b.charging ? ' (ładowanie)' : ''}`
}
