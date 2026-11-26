import { useCallback, useEffect, useState } from 'react'

// Prosi przeglądarkę o pamięć trwałą – wtedy Android nie usunie danych aplikacji przy braku miejsca.
// status: 'checking' | 'persistent' | 'not-persistent' | 'unsupported'
export function useStoragePersistence() {
  const [status, setStatus] = useState('checking')

  const request = useCallback(async () => {
    if (!navigator.storage?.persist) {
      setStatus('unsupported')
      return
    }
    try {
      const already = await navigator.storage.persisted()
      const granted = already || (await navigator.storage.persist())
      setStatus(granted ? 'persistent' : 'not-persistent')
    } catch {
      setStatus('not-persistent')
    }
  }, [])

  useEffect(() => {
    request()
  }, [request])

  return { status, request }
}
