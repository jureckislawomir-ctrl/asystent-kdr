import { readSetting, writeSetting } from '../../lib/storage'

// Szkic otwartego okna ODO – przetrwa odświeżenie/ponowne uruchomienie aplikacji.
// { type, rotaId, manual, baseAt (godzina otwarcia okna), data (wpisane pola), savedAt }
const KEY = 'odo.draft'
const TTL_MS = 15 * 60_000 // niezapisany szkic wygasa po 15 min

export const DRAFT_TYPES = ['newRota', 'assignRA', 'check', 'workpoint', 'exit', 'enterRA', 'decision']

export function loadDraft() {
  const d = readSetting(KEY, null)
  if (!d || !DRAFT_TYPES.includes(d.type)) return null
  if (Date.now() - (d.savedAt ?? 0) > TTL_MS) {
    clearDraft()
    return null
  }
  return d
}

export function startDraft({ type, rotaId = null, manual = false }) {
  if (!DRAFT_TYPES.includes(type)) return clearDraft()
  writeSetting(KEY, { type, rotaId, manual, baseAt: Date.now(), data: null, savedAt: Date.now() })
}

export function updateDraft(data) {
  const d = readSetting(KEY, null)
  if (!d) return
  writeSetting(KEY, { ...d, data, savedAt: Date.now() })
}

export function clearDraft() {
  try {
    localStorage.removeItem('kdr.' + KEY)
  } catch {
    /* ignoruj */
  }
}
