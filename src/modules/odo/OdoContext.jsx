import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, getActiveAction, actionSettings, onStorageError, purgeOldActions, getDefaultSettings } from './db'

// Wspólny stan modułu ODO na poziomie całej aplikacji – alarm kontroli działa w każdym module.
const OdoCtx = createContext(null)
export const useOdo = () => useContext(OdoCtx)

export function OdoProvider({ children }) {
  const action = useLiveQuery(getActiveAction, [], null)
  const rotas = useLiveQuery(
    () => (action ? db.rotas.where('actionId').equals(action.id).sortBy('createdAt') : []),
    [action?.id],
    [],
  )
  const settings = useMemo(() => actionSettings(action), [action])
  const [dialog, setDialog] = useState(null) // { type, rotaId?, ... }
  const [storageError, setStorageError] = useState(null)

  useEffect(() => onStorageError((e) => setStorageError(e?.message || String(e))), [])
  useEffect(() => {
    purgeOldActions(getDefaultSettings().retentionDays).catch(() => {})
  }, [])

  const open = useCallback((type, extra = {}) => setDialog({ type, ...extra }), [])
  const close = useCallback(() => setDialog(null), [])

  const value = useMemo(
    () => ({ action, rotas, settings, dialog, open, close, storageError, clearStorageError: () => setStorageError(null) }),
    [action, rotas, settings, dialog, open, close, storageError],
  )
  return <OdoCtx.Provider value={value}>{children}</OdoCtx.Provider>
}
