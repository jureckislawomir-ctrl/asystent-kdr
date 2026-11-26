import { useCallback, useEffect, useRef, useState } from 'react'
import { readSetting, writeSetting } from '../lib/storage'

// Blokada wygaszania ekranu (Wake Lock API).
// System zwalnia blokadę, gdy aplikacja schodzi w tło – odnawiamy ją po powrocie.
export function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [wanted, setWanted] = useState(() => readSetting('wakeLock', true))
  const [active, setActive] = useState(false)
  const sentinel = useRef(null)

  const acquire = useCallback(async () => {
    if (!supported || sentinel.current || document.visibilityState !== 'visible') return
    try {
      const s = await navigator.wakeLock.request('screen')
      sentinel.current = s
      setActive(true)
      s.addEventListener('release', () => {
        sentinel.current = null
        setActive(false)
      })
    } catch {
      setActive(false) // np. tryb oszczędzania baterii
    }
  }, [supported])

  const release = useCallback(async () => {
    try {
      await sentinel.current?.release()
    } catch {
      /* ignoruj */
    }
    sentinel.current = null
    setActive(false)
  }, [])

  useEffect(() => {
    writeSetting('wakeLock', wanted)
    if (wanted) acquire()
    else release()
  }, [wanted, acquire, release])

  useEffect(() => {
    const onVisible = () => {
      if (wanted && document.visibilityState === 'visible') acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [wanted, acquire])

  const toggle = useCallback(() => setWanted((w) => !w), [])
  return { supported, wanted, active, toggle }
}
