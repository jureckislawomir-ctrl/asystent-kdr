import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getActiveAction, actionSettings, onStorageError, purgeOldActions, getDefaultSettings, dbHealth } from './db'
import { loadDraft, startDraft, clearDraft } from './drafts'

// Wspólny stan modułu ODO na poziomie całej aplikacji – alarm kontroli działa w każdym module.
const OdoCtx = createContext(null)
export const useOdo = () => useContext(OdoCtx)

// Okno otwarte przed odświeżeniem wraca z wpisanymi danymi (szkic z localStorage)
function initialDialog() {
  const d = loadDraft()
  if (!d) return null
  return { type: d.type, rotaId: d.rotaId ?? undefined, manual: d.manual, restored: true, baseAt: d.baseAt, draft: d.data }
}

export function OdoProvider({ children }) {
  const action = useLiveQuery(getActiveAction, [], null) // null = jeszcze się wczytuje, undefined = brak akcji
  // wynik niesie id akcji, dla której został policzony – żeby nie uznać starej, pustej listy za aktualną
  const rotasRaw = useLiveQuery(
    async () => ({
      actionId: action?.id ?? null,
      list: action ? await db.rotas.where('actionId').equals(action.id).sortBy('createdAt') : [],
    }),
    [action?.id],
  )
  const rotas = useMemo(() => rotasRaw?.list ?? [], [rotasRaw])
  const loaded = action !== null && rotasRaw !== undefined && rotasRaw.actionId === (action?.id ?? null)
  const settings = useMemo(() => actionSettings(action), [action])
  const [dialog, setDialog] = useState(initialDialog) // { type, rotaId?, restored?, baseAt?, draft? }
  const [storageError, setStorageError] = useState(null)
  const [dbStatus, setDbStatus] = useState({ ok: true })
  const [otherWindow, setOtherWindow] = useState(false)

  useEffect(() => onStorageError((e) => setStorageError(e?.message || String(e))), [])
  useEffect(() => {
    purgeOldActions(getDefaultSettings().retentionDays).catch(() => {})
  }, [])

  // Przywrócony szkic dla roty, której już nie ma (np. akcja zakończona) – nie otwieraj
  useEffect(() => {
    if (!loaded || !dialog?.rotaId) return
    if (!rotas.some((r) => r.id === dialog.rotaId)) {
      clearDraft()
      setDialog(null)
    }
  }, [loaded, rotas, dialog])

  // Test bazy: przy starcie i po każdym powrocie do aplikacji
  useEffect(() => {
    const check = () => dbHealth().then(setDbStatus)
    check()
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Druga kopia aplikacji (ikona + karta Chrome) może zablokować bazę – wykrywamy i ostrzegamy
  useEffect(() => {
    if (!('BroadcastChannel' in window)) return
    const me = Math.random().toString(36).slice(2)
    const ch = new BroadcastChannel('asystent-kdr')
    ch.onmessage = (e) => {
      if (e.data?.from === me) return
      if (e.data?.type === 'hello') ch.postMessage({ type: 'here', from: me })
      if (e.data?.type === 'hello' || e.data?.type === 'here') setOtherWindow(true)
      if (e.data?.type === 'bye') setOtherWindow(false)
    }
    ch.postMessage({ type: 'hello', from: me })
    const bye = () => ch.postMessage({ type: 'bye', from: me })
    window.addEventListener('pagehide', bye)
    return () => {
      bye()
      window.removeEventListener('pagehide', bye)
      ch.close()
    }
  }, [])

  const open = useCallback((type, extra = {}) => {
    startDraft({ type, rotaId: extra.rotaId, manual: extra.manual })
    setDialog({ type, ...extra })
  }, [])
  const close = useCallback(() => {
    clearDraft()
    setDialog(null)
  }, [])

  const value = useMemo(
    () => ({
      action, rotas, settings, dialog, open, close, storageError, dbStatus, otherWindow,
      clearStorageError: () => setStorageError(null),
      recheckDb: () => dbHealth().then(setDbStatus),
    }),
    [action, rotas, settings, dialog, open, close, storageError, dbStatus, otherWindow],
  )
  return <OdoCtx.Provider value={value}>{children}</OdoCtx.Provider>
}
