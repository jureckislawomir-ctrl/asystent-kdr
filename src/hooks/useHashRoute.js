import { useCallback, useEffect, useState } from 'react'
import { MODULES, DEFAULT_MODULE } from '../config/modules'
import { readSetting, writeSetting } from '../lib/storage'

// Routing przez #/adres – działa na każdym hostingu i z przyciskiem „Wstecz” Androida.
// Ostatnia zakładka jest zapamiętywana: po odświeżeniu lub ponownym uruchomieniu (start bez #)
// aplikacja wraca tam, gdzie była – np. do trwającej kontroli ODO, a nie na pulpit.
const isModule = (id) => MODULES.some((m) => m.id === id)

const parse = () => {
  const id = window.location.hash.replace(/^#\/?/, '')
  if (isModule(id)) return id
  const last = readSetting('route', DEFAULT_MODULE)
  return isModule(last) ? last : DEFAULT_MODULE
}

export function useHashRoute() {
  const [route, setRoute] = useState(parse)

  useEffect(() => {
    // uzupełnij adres, żeby „Wstecz” i kolejne odświeżenia działały spójnie
    if (window.location.hash.replace(/^#\/?/, '') !== route) window.history.replaceState(null, '', `#/${route}`)
    const onChange = () => setRoute(parse())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    writeSetting('route', route)
  }, [route])

  const navigate = useCallback((id) => {
    if (window.location.hash.replace(/^#\/?/, '') !== id) window.location.hash = '/' + id
  }, [])

  return [route, navigate]
}
