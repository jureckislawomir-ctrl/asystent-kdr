// Logika zarządzania powietrzem wg WSZP (Wielkopolski System Zarządzania Powietrzem, KW PSP Poznań 2023).
// Funkcje czyste – bez bazy i bez Reacta, testowane skryptem tools/test_odo_logic.mjs.

export const DEFAULT_SETTINGS = {
  reserve: 60, // rezerwa obliczeniowa [bar] – wykres WSZP
  intervalMin: 5, // interwał kontroli ciśnienia [min]
  marginBar: 10, // pytanie o decyzję KDR, gdy ciśnienie ≤ prognoza + margines
  retentionDays: 90, // przechowywanie zakończonych akcji
}

/**
 * Prognozowane ciśnienie wycofania jednego ratownika.
 * - stwierdzony punkt pracy: R + (Pwej − Ppp)
 * - brak punktu pracy:       (Pwej − R) / 2 + R
 * Wynik zaokrąglany w górę do pełnego bara (strona bezpieczna).
 */
export function prognosis(entry, workPoint, reserve) {
  if (!Number.isFinite(entry)) return null
  if (Number.isFinite(workPoint)) return Math.ceil(reserve + (entry - workPoint))
  return Math.ceil((entry - reserve) / 2 + reserve)
}

/** Stan ratownika względem prognozy: 'ok' | 'near' | 'reached' | 'unknown'. */
export function memberState(pressure, prog, marginBar) {
  if (!Number.isFinite(pressure) || !Number.isFinite(prog)) return 'unknown'
  const d = pressure - prog
  if (d <= 0) return 'reached'
  if (d <= marginBar) return 'near'
  return 'ok'
}

const STATE_RANK = { unknown: 0, ok: 1, near: 2, reached: 3 }
export const worstState = (states) => states.reduce((a, b) => (STATE_RANK[b] > STATE_RANK[a] ? b : a), 'unknown')

/** Ostatni odczyt ciśnienia ratownika `i` (wejście, punkt pracy, kontrola lub wyjście). */
export function lastPressure(rota, i) {
  for (let k = rota.readings.length - 1; k >= 0; k--) {
    const p = rota.readings[k].p[i]
    if (Number.isFinite(p)) return p
  }
  return null
}

/** Prognozy wszystkich ratowników roty. */
export function rotaPrognoses(rota, reserve) {
  const entry = rota.readings.find((r) => r.type === 'entry')
  const wp = rota.readings.find((r) => r.type === 'workpoint')
  return rota.members.map((_, i) => prognosis(entry?.p[i], wp?.p[i], reserve))
}

/** Pełny stan ratowników roty (ciśnienie, prognoza, zapas nad prognozą, stan). */
export function rotaMemberStatus(rota, settings) {
  const progs = rotaPrognoses(rota, settings.reserve)
  return rota.members.map((name, i) => {
    const p = lastPressure(rota, i)
    const prog = progs[i]
    return {
      name,
      entry: rota.readings.find((r) => r.type === 'entry')?.p[i] ?? null,
      workPoint: rota.readings.find((r) => r.type === 'workpoint')?.p[i] ?? null,
      pressure: p,
      prognosis: prog,
      margin: Number.isFinite(p) && Number.isFinite(prog) ? p - prog : null,
      state: memberState(p, prog, settings.marginBar),
    }
  })
}

export const ACTIVE_STATUSES = ['in', 'withdrawing']

/** Termin następnej kontroli [ms]: ostatni odczyt + interwał (lub odłożenie, jeśli późniejsze). */
export function nextCheckDue(rota, intervalMin) {
  if (!ACTIVE_STATUSES.includes(rota.status) || rota.readings.length === 0) return null
  const lastAt = rota.readings[rota.readings.length - 1].at
  const due = lastAt + intervalMin * 60_000
  return Math.max(due, rota.snoozeUntil ?? 0)
}

/**
 * Szacunek czasu [min] do osiągnięcia prognozy, z tempa spadku między dwoma ostatnimi odczytami.
 * Tylko orientacyjnie – decyduje kontrola ciśnienia.
 */
export function estimateMinutesToPrognosis(rota, i, prog) {
  const pts = rota.readings.filter((r) => Number.isFinite(r.p[i]))
  if (pts.length < 2 || !Number.isFinite(prog)) return null
  const a = pts[pts.length - 2]
  const b = pts[pts.length - 1]
  const minutes = (b.at - a.at) / 60_000
  const drop = a.p[i] - b.p[i]
  if (minutes < 0.5 || drop <= 0) return null
  const rate = drop / minutes // bar/min
  return Math.max(0, (b.p[i] - prog) / rate)
}

// ---------- formatowanie ----------
export const fmtHM = (ms) =>
  new Date(ms).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })

export function fmtDuration(ms) {
  const neg = ms < 0
  const s = Math.floor(Math.abs(ms) / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(h ? 2 : 1, '0')
  const ss = String(sec).padStart(2, '0')
  return `${neg ? '−' : ''}${h ? `${h}:` : ''}${mm}:${ss}`
}

export const joinP = (arr) => arr.map((p) => (Number.isFinite(p) ? p : '—')).join(' / ')
