// Logika zarządzania powietrzem wg WSZP (Wielkopolski System Zarządzania Powietrzem, KW PSP Poznań 2023).
// Funkcje czyste – bez bazy i bez Reacta, testowane skryptem tools/test_odo_logic.mjs.

export const DEFAULT_SETTINGS = {
  reserve: 60, // rezerwa obliczeniowa [bar] – wykres WSZP
  intervalMin: 5, // interwał kontroli ciśnienia [min]
  marginBar: 10, // pytanie o decyzję KDR, gdy ciśnienie ≤ prognoza + margines
  retentionDays: 90, // przechowywanie zakończonych akcji
  basePressure: 300, // wartość wstawiana przy WEJŚCIU (butla 300 bar) – poprawiana ±10 lub wpisaniem
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

/** Najniższe ciśnienie z odczytu. Kontrola ma jedno pole (najniższe w rocie), wejście/PRACA/wyjście – po jednym na ratownika. */
export function readingMin(reading) {
  const v = (reading?.p ?? []).filter(Number.isFinite)
  return v.length ? Math.min(...v) : null
}

/**
 * WYCOFAJ roty – zawsze od NAJNIŻSZEGO wprowadzonego ciśnienia, niezależnie od tego, czyje to ciśnienie
 * (decyzja użytkownika 27.11, zasada „dwóch wchodzi, dwóch wychodzi”):
 * - z PRACĄ:  R + (najniższe WEJŚCIE − najniższe PRACA)
 * - bez PRACY: (najniższe WEJŚCIE − R) / 2 + R
 */
export function rotaPrognosis(rota, reserve) {
  const entry = rota.readings.find((r) => r.type === 'entry')
  const wp = rota.readings.find((r) => r.type === 'workpoint')
  return prognosis(readingMin(entry), readingMin(wp), reserve)
}

/**
 * Stan roty: najniższe ciśnienie z ostatniego odczytu porównane z WYCOFAJ roty.
 */
export function rotaStatus(rota, settings) {
  const entry = rota.readings.find((r) => r.type === 'entry')
  const wp = rota.readings.find((r) => r.type === 'workpoint')
  const prog = rotaPrognosis(rota, settings.reserve)
  const last = rota.readings[rota.readings.length - 1]
  const pressure = readingMin(last)
  return {
    prognosis: prog,
    entryMin: readingMin(entry),
    workPointMin: readingMin(wp),
    pressure,
    lastAt: last?.at ?? null,
    lastType: last?.type ?? null,
    margin: Number.isFinite(pressure) && Number.isFinite(prog) ? pressure - prog : null,
    state: memberState(pressure, prog, settings.marginBar),
  }
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
 * Szacunek czasu [min] do osiągnięcia WYCOFAJ roty, z tempa spadku najniższego ciśnienia
 * między dwoma ostatnimi odczytami. Tylko orientacyjnie – decyduje kontrola ciśnienia.
 */
export function estimateMinutesToPrognosis(rota, prog) {
  const pts = rota.readings.filter((r) => Number.isFinite(readingMin(r)))
  if (pts.length < 2 || !Number.isFinite(prog)) return null
  const a = pts[pts.length - 2]
  const b = pts[pts.length - 1]
  const minutes = (b.at - a.at) / 60_000
  const drop = readingMin(a) - readingMin(b)
  if (minutes < 0.5 || drop <= 0) return null
  return Math.max(0, (readingMin(b) - prog) / (drop / minutes))
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
