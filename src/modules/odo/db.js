import Dexie from 'dexie'
import { readSetting, writeSetting } from '../../lib/storage'
import { DEFAULT_SETTINGS, prognosis, joinP, fmtDuration } from './logic'

// Baza w pamięci tabletu (IndexedDB). Dziennik (events) jest tylko dopisywany – korekta = nowy wpis.
export const db = new Dexie('asystent-kdr')
db.version(1).stores({
  actions: '++id, startedAt, endedAt',
  rotas: '++id, actionId, status',
  events: '++id, actionId, at',
})

// ---------- błędy zapisu: zawsze głośno, nigdy po cichu ----------
const errorListeners = new Set()
export const onStorageError = (fn) => (errorListeners.add(fn), () => errorListeners.delete(fn))
async function safe(fn) {
  try {
    return await fn()
  } catch (e) {
    console.error('[ODO] błąd zapisu', e)
    errorListeners.forEach((l) => l(e))
    throw e
  }
}

// ---------- ustawienia ----------
export const getDefaultSettings = () => ({ ...DEFAULT_SETTINGS, ...readSetting('odo.settings', {}) })
export const saveDefaultSettings = (s) => writeSetting('odo.settings', s)
export const actionSettings = (action) =>
  action ? { ...getDefaultSettings(), ...action.settings } : getDefaultSettings()

// ---------- akcja ----------
export async function getActiveAction() {
  return db.actions.filter((a) => !a.endedAt).first()
}

async function ensureActiveAction() {
  const existing = await getActiveAction()
  if (existing) return existing
  const now = Date.now()
  const s = getDefaultSettings()
  const settings = { reserve: s.reserve, intervalMin: s.intervalMin, marginBar: s.marginBar }
  const id = await db.actions.add({ startedAt: now, endedAt: null, settings })
  await db.events.add({
    actionId: id, rotaId: null, at: now, type: 'action_start',
    text: `Rozpoczęcie kontroli ODO. Rezerwa ${settings.reserve} bar, kontrola co ${settings.intervalMin} min.`,
  })
  return db.actions.get(id)
}

const log = (actionId, rotaId, type, text, at = Date.now()) => db.events.add({ actionId, rotaId, at, type, text })

const who = (rota) => {
  const names = rota.members.filter(Boolean).join(', ')
  return `${rota.label}${names ? ` (${names})` : ''}`
}

const SPOLEM_KEYS = ['S', 'P', 'O', 'Ł', 'E', 'M']
const spolemText = (sp) => {
  const missing = SPOLEM_KEYS.filter((k) => !sp?.[k])
  return missing.length ? `SPOŁEM niepełne – brak: ${missing.join(', ')}` : 'SPOŁEM: komplet'
}

// ---------- roty ----------
export const createRota = ({ label, members, spolem, pressures, at }) =>
  safe(() =>
    db.transaction('rw', db.actions, db.rotas, db.events, async () => {
      const action = await ensureActiveAction()
      const rota = {
        actionId: action.id, kind: 'rota', label, members, spolem, status: 'in',
        createdAt: Date.now(), readings: [{ type: 'entry', at, p: pressures }], snoozeUntil: null,
      }
      const id = await db.rotas.add(rota)
      const progs = pressures.map((p) => prognosis(p, null, action.settings.reserve))
      await log(action.id, id, 'entry',
        `${who(rota)} – WEJŚCIE: ${joinP(pressures)} bar. WYCOFAJ (bez PRACY): ${joinP(progs)} bar. ${spolemText(spolem)}.`, at)
      return id
    }),
  )

export const assignRA = ({ label, members }) =>
  safe(() =>
    db.transaction('rw', db.actions, db.rotas, db.events, async () => {
      const action = await ensureActiveAction()
      const rota = {
        actionId: action.id, kind: 'ra', label, members, spolem: null, status: 'standby',
        createdAt: Date.now(), readings: [], snoozeUntil: null,
      }
      const id = await db.rotas.add(rota)
      await log(action.id, id, 'ra_assign', `Wyznaczono rotę asekuracyjną: ${who(rota)}.`)
      return id
    }),
  )

export const enterRA = (rotaId, { spolem, pressures, at }) =>
  safe(() =>
    db.transaction('rw', db.actions, db.rotas, db.events, async () => {
      const rota = await db.rotas.get(rotaId)
      const action = await db.actions.get(rota.actionId)
      rota.status = 'in'
      rota.spolem = spolem
      rota.readings.push({ type: 'entry', at, p: pressures })
      await db.rotas.put(rota)
      const progs = pressures.map((p) => prognosis(p, null, action.settings.reserve))
      await log(rota.actionId, rotaId, 'entry',
        `${who(rota)} – WEJŚCIE ROTY ASEKURACYJNEJ: ${joinP(pressures)} bar. WYCOFAJ (bez PRACY): ${joinP(progs)} bar. ${spolemText(spolem)}. Wyznacz nową rotę asekuracyjną.`, at)
    }),
  )

export const addReading = (rotaId, type, pressures, at) =>
  safe(() =>
    db.transaction('rw', db.actions, db.rotas, db.events, async () => {
      const rota = await db.rotas.get(rotaId)
      const action = await db.actions.get(rota.actionId)
      rota.readings.push({ type, at, p: pressures })
      rota.snoozeUntil = null
      await db.rotas.put(rota)
      if (type === 'workpoint') {
        const entry = rota.readings.find((r) => r.type === 'entry')
        const progs = pressures.map((p, i) => prognosis(entry?.p[i], p, action.settings.reserve))
        await log(rota.actionId, rotaId, 'workpoint',
          `${who(rota)} – PRACA: ${joinP(pressures)} bar. WYCOFAJ: ${joinP(progs)} bar.`, at)
      } else {
        await log(rota.actionId, rotaId, 'check', `${who(rota)} – kontrola: ${joinP(pressures)} bar.`, at)
      }
    }),
  )

export const exitRota = (rotaId, pressures, at) =>
  safe(() =>
    db.transaction('rw', db.rotas, db.events, async () => {
      const rota = await db.rotas.get(rotaId)
      const entry = rota.readings.find((r) => r.type === 'entry')
      rota.readings.push({ type: 'exit', at, p: pressures })
      rota.status = 'out'
      rota.exitAt = at
      rota.snoozeUntil = null
      await db.rotas.put(rota)
      const dur = entry ? `, w strefie ${fmtDuration(at - entry.at)}` : ''
      await log(rota.actionId, rotaId, 'exit',
        `${who(rota)} – WYJŚCIE: ${joinP(pressures)} bar${dur}. Odpoczynek i nawodnienie przed kolejnym WEJŚCIEM.`, at)
    }),
  )

/** Decyzja KDR: 'withdraw' (wycofanie), 'continue' (kontynuacja poniżej WYCOFAJ), 'informed' (blisko WYCOFAJ, rota poinformowana). */
export const recordDecision = (rotaId, kind, detail) =>
  safe(() =>
    db.transaction('rw', db.rotas, db.events, async () => {
      const rota = await db.rotas.get(rotaId)
      if (kind === 'withdraw' && rota.status === 'in') {
        rota.status = 'withdrawing'
        await db.rotas.put(rota)
      }
      const text = {
        withdraw: `${who(rota)} – DECYZJA KDR: WYCOFANIE ROTY.${detail ? ` ${detail}` : ''}`,
        continue: `${who(rota)} – DECYZJA KDR: KONTYNUACJA PONIŻEJ WYCOFAJ. ${detail}`,
        informed: `${who(rota)} – blisko WYCOFAJ, rota poinformowana. ${detail}`,
      }[kind]
      await log(rota.actionId, rotaId, `decision_${kind}`, text)
    }),
  )

export const snoozeCheck = (rotaId, minutes = 1) =>
  safe(() =>
    db.transaction('rw', db.rotas, db.events, async () => {
      const rota = await db.rotas.get(rotaId)
      rota.snoozeUntil = Date.now() + minutes * 60_000
      await db.rotas.put(rota)
      await log(rota.actionId, rotaId, 'snooze', `${who(rota)} – kontrola odłożona o ${minutes} min.`)
    }),
  )

export const removeStandbyRA = (rotaId) =>
  safe(() =>
    db.transaction('rw', db.rotas, db.events, async () => {
      const rota = await db.rotas.get(rotaId)
      if (rota?.status !== 'standby') return
      await db.rotas.delete(rotaId)
      await log(rota.actionId, null, 'ra_remove', `Odwołano rotę asekuracyjną: ${who(rota)}.`)
    }),
  )

export const updateActionSettings = (actionId, settings) =>
  safe(async () => {
    saveDefaultSettings({ ...getDefaultSettings(), ...settings })
    if (!actionId) return
    await db.transaction('rw', db.actions, db.events, async () => {
      await db.actions.update(actionId, { settings })
      await log(actionId, null, 'settings',
        `Zmiana ustawień: rezerwa ${settings.reserve} bar, kontrola co ${settings.intervalMin} min, ostrzeżenie ${settings.marginBar} bar nad WYCOFAJ.`)
    })
  })

export const endAction = (actionId) =>
  safe(() =>
    db.transaction('rw', db.actions, db.events, async () => {
      const now = Date.now()
      await db.actions.update(actionId, { endedAt: now })
      await log(actionId, null, 'action_end', 'Zakończenie kontroli ODO.', now)
    }),
  )

export const deleteAction = (actionId) =>
  safe(() =>
    db.transaction('rw', db.actions, db.rotas, db.events, async () => {
      await db.rotas.where('actionId').equals(actionId).delete()
      await db.events.where('actionId').equals(actionId).delete()
      await db.actions.delete(actionId)
    }),
  )

/** Usuwa zakończone akcje starsze niż `days` dni (RODO). */
export async function purgeOldActions(days) {
  const limit = Date.now() - days * 86_400_000
  const old = await db.actions.filter((a) => a.endedAt && a.endedAt < limit).toArray()
  for (const a of old) await deleteAction(a.id)
  return old.length
}
