import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const UPDATE_CHECK_MS = 60 * 60 * 1000 // sprawdzanie aktualizacji co godzinę (tylko gdy jest sieć)

// Stan Service Workera: czy aplikacja jest zapisana do pracy offline i czy czeka aktualizacja.
export function usePwa() {
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        if (navigator.onLine) registration.update().catch(() => {})
      }, UPDATE_CHECK_MS)
    },
  })

  // Po ponownym uruchomieniu offlineReady = false, ale SW już kontroluje stronę – to też „gotowa offline”
  const [controlled, setControlled] = useState(() => !!navigator.serviceWorker?.controller)
  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw) return
    const onChange = () => setControlled(!!sw.controller)
    sw.addEventListener('controllerchange', onChange)
    return () => sw.removeEventListener('controllerchange', onChange)
  }, [])

  return {
    devMode: import.meta.env.DEV,
    swSupported: 'serviceWorker' in navigator,
    offlineReady: offlineReady || controlled,
    needRefresh,
    applyUpdate: () => updateServiceWorker(true),
    postponeUpdate: () => setNeedRefresh(false),
  }
}
