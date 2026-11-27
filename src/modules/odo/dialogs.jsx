import { useEffect, useRef, useState } from 'react'
import { TriangleAlert, Check } from 'lucide-react'
import { Btn, Dialog, PressureFields, TimeAdjust } from '../../components/ui'
import { useOdo } from './OdoContext'
import {
  db, createRota, assignRA, enterRA, addReading, exitRota, recordDecision, updateActionSettings, endAction,
} from './db'
import { prognosis, rotaMemberStatus, lastPressure, ACTIVE_STATUSES } from './logic'
import { unlockAudio, testAlarm } from './audio'
import { updateDraft } from './drafts'
import { fmtHM } from './logic'

/** Zapis z widocznym stanem: „Zapisywanie…”, ostrzeżenie po 3 s, komunikat błędu – nic nie ginie po cichu. */
function useSaving() {
  const [st, setSt] = useState({ busy: false, slow: false, error: null })
  const timer = useRef(0)
  const run = (fn) => async () => {
    if (st.busy) return
    setSt({ busy: true, slow: false, error: null })
    timer.current = setTimeout(() => setSt((s) => ({ ...s, slow: true })), 3000)
    try {
      await fn()
      clearTimeout(timer.current)
      setSt({ busy: false, slow: false, error: null })
    } catch (e) {
      clearTimeout(timer.current)
      console.error('[ODO] zapis nieudany', e)
      setSt({ busy: false, slow: false, error: e?.message || String(e) })
    }
  }
  return [run, st]
}

function SaveStatus({ st }) {
  if (st.error)
    return (
      <p className="mr-auto flex max-w-xl items-center gap-2 font-bold text-alarm" role="alert">
        <TriangleAlert size={22} className="shrink-0" /> Zapis nieudany: {st.error}
      </p>
    )
  if (st.slow)
    return (
      <p className="mr-auto max-w-xl font-bold text-warn">
        Zapis trwa dłużej niż zwykle… Jeśli to nie minie: zamknij inne okna aplikacji (np. kartę w Chrome), a w ostateczności uruchom ponownie tablet.
      </p>
    )
  return null
}

const inputCls = 'min-h-14 w-full rounded-lg border-2 border-line bg-bg px-3 text-xl font-bold text-fg'
const toNums = (vals) => vals.map((v) => (v === '' || v == null ? NaN : Number(v)))
const allValid = (nums) => nums.every((n) => Number.isFinite(n) && n >= 0 && n <= 350)
const atFromOffset = (off) => (off === 0 ? Date.now() : Date.now() + off * 60_000)
// godzina zdarzenia: przy przywróconym wpisie liczona od pierwotnej godziny otwarcia okna
const eventAt = (dialog, off) => (dialog?.restored && dialog.baseAt ? dialog.baseAt + off * 60_000 : atFromOffset(off))

// po przywróceniu szkicu kursor wpisu na pierwszym pustym polu
const firstEmpty = (vals) => Math.max(0, (vals ?? []).findIndex((v) => !v))

/** Zapisuje wpisane pola jako szkic (przetrwa odświeżenie). */
function useDraftSync(data) {
  const json = JSON.stringify(data)
  useEffect(() => {
    updateDraft(JSON.parse(json))
  }, [json])
}

function RestoredNote({ dialog }) {
  if (!dialog?.restored) return null
  return (
    <p className="rounded-lg border-2 border-warn px-3 py-2 font-bold text-warn">
      Przywrócono niezapisany wpis z {fmtHM(dialog.baseAt)} (aplikacja została odświeżona). Sprawdź dane i zapisz.
    </p>
  )
}

// Zgoda na powiadomienia: tylko świadomie, osobnym przyciskiem – nigdy w trakcie wpisywania roty
// (okno zgody Androida blokuje ekran do czasu odpowiedzi).
export const notificationStatus = () => ('Notification' in window ? Notification.permission : 'unsupported')
export async function requestNotifications() {
  try {
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
  } catch {
    /* ignoruj */
  }
  return notificationStatus()
}

// ---------- SPOŁEM ----------
const SPOLEM = [
  ['S', 'Sygnalizatory'],
  ['P', 'Poziom powietrza'],
  ['O', 'Oświetlenie'],
  ['Ł', 'Łączność'],
  ['E', 'Ekwipunek'],
  ['M', 'Meldunek o wejściu'],
]

function SpolemPicker({ value, onChange }) {
  return (
    <section>
      <h3 className="mb-2 text-lg font-black">Kontrola przed WEJŚCIEM – SPOŁEM</h3>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SPOLEM.map(([k, label]) => {
          const on = !!value[k]
          return (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...value, [k]: !on })}
              aria-pressed={on}
              className={`flex min-h-16 items-center gap-3 rounded-lg border-2 px-3 text-left font-bold ${
                on ? 'border-ok bg-surface text-ok' : 'border-line bg-bg text-fg'
              }`}
            >
              <span className="w-8 text-3xl font-black text-accent">{k}</span>
              <span className="flex-1">{label}</span>
              {on ? <Check size={28} /> : <span className="text-sm text-muted">—</span>}
            </button>
          )
        })}
      </div>
    </section>
  )
}

const spolemComplete = (sp) => SPOLEM.every(([k]) => sp[k])

function MembersEditor({ members, setMembers }) {
  return (
    <section>
      <h3 className="mb-2 text-lg font-black">Ratownicy (imię lub pseudonim)</h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {members.map((m, i) => (
          <input
            key={i}
            className={inputCls}
            value={m}
            placeholder={`Ratownik ${i + 1}`}
            onChange={(e) => setMembers(members.map((x, k) => (k === i ? e.target.value : x)))}
          />
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {members.length < 3 && <Btn onClick={() => setMembers([...members, ''])}>+ trzeci ratownik</Btn>}
        {members.length > 2 && <Btn onClick={() => setMembers(members.slice(0, -1))}>− usuń trzeciego</Btn>}
      </div>
    </section>
  )
}

const entryHint = (v) => {
  const n = Number(v)
  if (v && n < 270) return '⚠ WEJŚCIE poniżej 270 bar'
  return 'WEJŚCIE'
}

// ---------- Nowa rota ----------
export function NewRotaDialog() {
  const { rotas, settings, close, dialog } = useOdo()
  const d = dialog?.draft ?? {}
  const n = rotas.filter((r) => r.kind === 'rota').length + 1
  const [label, setLabel] = useState(d.label ?? `Rota ${n}`)
  const [members, setMembers] = useState(d.members ?? ['', ''])
  const [spolem, setSpolem] = useState(d.spolem ?? {})
  const [vals, setVals] = useState(d.vals ?? ['', ''])
  const [active, setActive] = useState(() => firstEmpty(d.vals))
  const [off, setOff] = useState(d.off ?? 0)
  useDraftSync({ label, members, spolem, vals, off })
  const values = members.map((_, i) => vals[i] ?? '')
  const nums = toNums(values)
  const ok = label.trim() && allValid(nums)

  const [run, st] = useSaving()
  const save = run(async () => {
    unlockAudio()
    await createRota({ label: label.trim(), members: members.map((m) => m.trim()), spolem, pressures: nums, at: eventAt(dialog, off) })
    close()
  })

  return (
    <Dialog
      wide
      title="Nowa rota – WEJŚCIE"
      onClose={close}
      footer={
        <>
          <SaveStatus st={st} />
          <Btn variant="primary" className="min-w-56 text-xl" disabled={!ok || st.busy} onClick={save}>
            {st.busy ? 'Zapisywanie…' : spolemComplete(spolem) ? 'WEJŚCIE' : 'WEJŚCIE (SPOŁEM niepełne)'}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <RestoredNote dialog={dialog} />
        <section className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
          <label className="text-lg font-black" htmlFor="rota-label">Kryptonim roty</label>
          <input id="rota-label" className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
        </section>
        <MembersEditor members={members} setMembers={setMembers} />
        <SpolemPicker value={spolem} onChange={setSpolem} />
        <section>
          <h3 className="mb-2 text-lg font-black">Ciśnienie – WEJŚCIE</h3>
          <PressureFields
            names={members}
            values={values}
            setValues={setVals}
            active={Math.min(active, members.length - 1)}
            setActive={setActive}
            extra={(i) => {
              const p = nums[i]
              return Number.isFinite(p) ? `${entryHint(values[i])} · WYCOFAJ: ${prognosis(p, null, settings.reserve)} bar` : entryHint(values[i])
            }}
          />
        </section>
        <TimeAdjust offsetMin={off} setOffsetMin={setOff} label="Godzina WEJŚCIA" base={dialog?.restored ? dialog.baseAt : null} />
      </div>
    </Dialog>
  )
}

// ---------- Rota asekuracyjna ----------
export function AssignRADialog() {
  const { close, dialog } = useOdo()
  const d = dialog?.draft ?? {}
  const [label, setLabel] = useState(d.label ?? 'RA')
  const [members, setMembers] = useState(d.members ?? ['', ''])
  useDraftSync({ label, members })
  return (
    <Dialog
      title="Wyznacz rotę asekuracyjną"
      onClose={close}
      footer={
        <Btn variant="primary" disabled={!label.trim()} onClick={async () => (await assignRA({ label: label.trim(), members: members.map((m) => m.trim()) }), close())}>
          WYZNACZ RA
        </Btn>
      }
    >
      <div className="flex flex-col gap-4">
        <RestoredNote dialog={dialog} />
        <p className="text-muted">§ 38 rozporządzenia o BHS: rota asekuracyjna w pełnej gotowości, ze sprzętem do podjęcia pracy w strefie.</p>
        <section className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
          <label className="text-lg font-black" htmlFor="ra-label">Kryptonim</label>
          <input id="ra-label" className={inputCls} value={label} onChange={(e) => setLabel(e.target.value)} />
        </section>
        <MembersEditor members={members} setMembers={setMembers} />
      </div>
    </Dialog>
  )
}

// ---------- Odczyty: kontrola / punkt pracy / wyjście / wejście RA ----------
const TITLES = { check: 'Kontrola ciśnienia', workpoint: 'PRACA', exit: 'Wyjście ze strefy', enterRA: 'WEJŚCIE roty asekuracyjnej' }

export function PressureDialog({ type, rotaId }) {
  const { rotas, settings, close, open, dialog } = useOdo()
  const rota = rotas.find((r) => r.id === rotaId)
  const d = dialog?.draft ?? {}
  const [vals, setVals] = useState(() => d.vals ?? (rota ? rota.members.map(() => '') : []))
  const [active, setActive] = useState(() => firstEmpty(d.vals))
  const [off, setOff] = useState(d.off ?? 0)
  const [spolem, setSpolem] = useState(d.spolem ?? {})
  const [run, st] = useSaving()
  useDraftSync({ vals, off, spolem })
  if (!rota) return null

  const nums = toNums(vals)
  const ok = allValid(nums)
  const entry = rota.readings.find((r) => r.type === 'entry')
  const wp = rota.readings.find((r) => r.type === 'workpoint')

  const extra = (i) => {
    const p = nums[i]
    const prev = lastPressure(rota, i)
    if (type === 'enterRA') return Number.isFinite(p) ? `${entryHint(vals[i])} · WYCOFAJ: ${prognosis(p, null, settings.reserve)} bar` : entryHint(vals[i])
    if (type === 'workpoint') {
      const prog = Number.isFinite(p) ? prognosis(entry?.p[i], p, settings.reserve) : null
      return `WEJŚCIE ${entry?.p[i] ?? '—'} bar${prog != null ? ` → WYCOFAJ: ${prog} bar` : ''}`
    }
    const prog = prognosis(entry?.p[i], wp?.p[i], settings.reserve)
    let s = `WYCOFAJ ${prog ?? '—'} · poprzednio ${prev ?? '—'} bar`
    if (Number.isFinite(p) && Number.isFinite(prev) && p > prev + 5) s += ' · ⚠ wyżej niż poprzednio – sprawdź'
    else if (Number.isFinite(p) && Number.isFinite(prog)) {
      const d = p - prog
      if (d <= 0) s += ' · ⚠ WYCOFAJ – OSIĄGNIĘTE'
      else if (d <= settings.marginBar) s += ` · ⚠ blisko WYCOFAJ (+${d})`
    }
    return s
  }

  const save = run(async () => {
    unlockAudio()
    const at = eventAt(dialog, off)
    if (type === 'exit') {
      await exitRota(rota.id, nums, at)
      close()
      return
    }
    if (type === 'enterRA') {
      await enterRA(rota.id, { spolem, pressures: nums, at })
      close()
      return
    }
    await addReading(rota.id, type, nums, at)
    // po odczycie: czy potrzebna decyzja KDR?
    const fresh = await db.rotas.get(rota.id)
    const status = rotaMemberStatus(fresh, settings)
    if (fresh.status === 'in' && status.some((m) => m.state === 'near' || m.state === 'reached')) open('decision', { rotaId: rota.id })
    else close()
  })

  return (
    <Dialog
      wide
      title={`${TITLES[type]} – ${rota.label}`}
      onClose={close}
      footer={
        <>
          <SaveStatus st={st} />
          <Btn variant="primary" className="min-w-56 text-xl" disabled={!ok || st.busy} onClick={save}>
          {st.busy ? 'Zapisywanie…' : type === 'exit' ? 'ZAPISZ WYJŚCIE' : type === 'enterRA' ? 'WEJŚCIE RA' : type === 'workpoint' ? 'ZAPISZ PRACĘ' : 'ZAPISZ'}
          </Btn>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <RestoredNote dialog={dialog} />
        {type === 'enterRA' && <SpolemPicker value={spolem} onChange={setSpolem} />}
        {type === 'workpoint' && (
          <p className="text-muted">
            Ciśnienie po dojściu do miejsca pracy. WYCOFAJ = {settings.reserve} + (WEJŚCIE − PRACA). W razie wątpliwości lepiej zgłosić PRACĘ wcześniej.
          </p>
        )}
        <PressureFields names={rota.members} values={vals} setValues={setVals} active={active} setActive={setActive} extra={extra} />
        <TimeAdjust offsetMin={off} setOffsetMin={setOff} base={dialog?.restored ? dialog.baseAt : null} />
      </div>
    </Dialog>
  )
}

// ---------- Decyzja KDR ----------
const REASONS = ['Wentylacja / poprawa widoczności', 'Krótsza droga wyjścia', 'Rota blisko wyjścia', 'Inny powód – omówiony z rotą']

export function DecisionDialog({ rotaId, manual = false }) {
  const { rotas, settings, close } = useOdo()
  const rota = rotas.find((r) => r.id === rotaId)
  const [step, setStep] = useState('choose')
  if (!rota) return null
  const status = rotaMemberStatus(rota, settings)
  const reached = status.filter((m) => m.state === 'reached')
  const near = status.filter((m) => m.state === 'near')
  const fmt = (list) => list.map((m) => `${m.name || 'ratownik'} ${m.pressure}/${m.prognosis} bar`).join(', ')

  const withdraw = async () => {
    await recordDecision(rota.id, 'withdraw', manual ? '' : `(${fmt([...reached, ...near])})`)
    close()
  }

  return (
    <Dialog title={manual ? `Wycofanie roty – ${rota.label}` : `Decyzja KDR – ${rota.label}`} onClose={manual ? close : undefined}>
      <div className="flex flex-col gap-4">
        <ul className="flex flex-col gap-2">
          {status.map((m, i) => (
            <li
              key={i}
              className={`flex items-center justify-between gap-3 rounded-lg border-2 border-l-8 px-3 py-2 ${
                m.state === 'reached' ? 'border-alarm text-alarm' : m.state === 'near' ? 'border-warn text-warn' : 'border-line'
              }`}
            >
              <span className="text-xl font-black">{m.name || `Ratownik ${i + 1}`}</span>
              <span className="tabular text-xl font-bold">
                {m.pressure ?? '—'} bar · WYCOFAJ {m.prognosis ?? '—'}
                {m.state === 'reached' ? ' · OSIĄGNIĘTE' : m.state === 'near' ? ` · BLISKO (+${m.margin})` : ''}
              </span>
            </li>
          ))}
        </ul>

        {!manual && (
          <p className="flex items-center gap-2 rounded-lg border-2 border-warn px-3 py-2 text-lg font-black text-warn">
            <TriangleAlert size={26} /> Nie dopuść do gwizdka. Monitorowanie z zewnątrz nie zwalnia roty z samokontroli.
          </p>
        )}

        {step === 'choose' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Btn variant="primary" className="min-h-20 text-2xl" onClick={withdraw}>
              WYCOFANIE ROTY
            </Btn>
            {!manual && reached.length > 0 && (
              <Btn className="min-h-20 text-xl" onClick={() => setStep('reason')}>
                Kontynuacja poniżej WYCOFAJ…
              </Btn>
            )}
            {!manual && reached.length === 0 && (
              <Btn
                className="min-h-20 text-xl"
                onClick={async () => (await recordDecision(rota.id, 'informed', `(${fmt(near)}) – kontynuacja.`), close())}
              >
                Rota poinformowana – kontynuacja
              </Btn>
            )}
          </div>
        )}

        {step === 'reason' && (
          <section>
            <h3 className="mb-2 text-lg font-black">Powód kontynuacji poniżej WYCOFAJ (zapis do dziennika)</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {REASONS.map((r) => (
                <Btn
                  key={r}
                  className="min-h-16"
                  onClick={async () => (await recordDecision(rota.id, 'continue', `${fmt(reached)}. Powód: ${r}.`), close())}
                >
                  {r}
                </Btn>
              ))}
            </div>
            <Btn variant="ghost" className="mt-3" onClick={() => setStep('choose')}>
              ← Wróć
            </Btn>
          </section>
        )}
      </div>
    </Dialog>
  )
}

// ---------- Ustawienia ----------
function Stepper({ label, value, set, step, min, max, unit }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="min-w-56 text-lg font-bold">{label}</span>
      <Btn onClick={() => set(Math.max(min, value - step))}>−</Btn>
      <span className="tabular min-w-24 text-center text-3xl font-black">
        {value} <span className="text-base text-muted">{unit}</span>
      </span>
      <Btn onClick={() => set(Math.min(max, value + step))}>+</Btn>
    </div>
  )
}

export function SettingsDialog() {
  const { action, settings, close } = useOdo()
  const [s, setS] = useState({ reserve: settings.reserve, intervalMin: settings.intervalMin, marginBar: settings.marginBar })
  return (
    <Dialog
      title="Ustawienia kontroli ODO"
      onClose={close}
      footer={<Btn variant="primary" onClick={async () => (await updateActionSettings(action?.id, s), close())}>ZAPISZ</Btn>}
    >
      <div className="flex flex-col gap-4">
        <Stepper label="Rezerwa obliczeniowa" value={s.reserve} set={(v) => setS({ ...s, reserve: v })} step={5} min={40} max={80} unit="bar" />
        <Stepper label="Kontrola ciśnienia co" value={s.intervalMin} set={(v) => setS({ ...s, intervalMin: v })} step={1} min={1} max={15} unit="min" />
        <Stepper label="Ostrzeżenie nad WYCOFAJ" value={s.marginBar} set={(v) => setS({ ...s, marginBar: v })} step={5} min={0} max={30} unit="bar" />
        <NotificationSetting />
        <div className="flex flex-wrap items-center gap-3 border-t-2 border-line pt-3">
          <Btn onClick={testAlarm}>Test dźwięku i wibracji</Btn>
          <span className="text-sm text-muted">Dźwięk idzie głośnością multimediów Androida – sprawdź, czy nie jest ściszona.</span>
        </div>
        <p className="text-sm text-muted">
          Wzory WSZP: WYCOFAJ = rezerwa + (WEJŚCIE − PRACA); bez PRACY: (WEJŚCIE − rezerwa) ÷ 2 + rezerwa.
          {action ? ' Zmiana obowiązuje w bieżącej akcji i zostanie zapisana w dzienniku.' : ''}
        </p>
      </div>
    </Dialog>
  )
}

function NotificationSetting() {
  const [st, setSt] = useState(notificationStatus)
  const text = {
    granted: 'Powiadomienia włączone – alarm kontroli pojawi się także, gdy aplikacja jest w tle.',
    default: 'Powiadomienia wyłączone – gdy aplikacja jest w tle, alarm kontroli może nie dotrzeć.',
    denied: 'Powiadomienia zablokowane – włącz je w ustawieniach aplikacji w Androidzie (Powiadomienia).',
    unsupported: 'Ta przeglądarka nie obsługuje powiadomień.',
  }[st]
  return (
    <div className="flex flex-wrap items-center gap-3 border-t-2 border-line pt-3">
      {st === 'default' && <Btn onClick={async () => setSt(await requestNotifications())}>Włącz powiadomienia</Btn>}
      <span className={`text-sm font-bold ${st === 'granted' ? 'text-ok' : 'text-warn'}`}>{text}</span>
    </div>
  )
}

// ---------- Zakończenie akcji ----------
export function EndActionDialog() {
  const { action, rotas, close } = useOdo()
  const inZone = rotas.filter((r) => ACTIVE_STATUSES.includes(r.status))
  return (
    <Dialog
      title="Zakończyć kontrolę ODO?"
      onClose={close}
      footer={
        <Btn variant="primary" onClick={async () => (await endAction(action.id), close())}>
          {inZone.length ? 'ZAKOŃCZ MIMO TO' : 'ZAKOŃCZ'}
        </Btn>
      }
    >
      {inZone.length ? (
        <p className="flex items-center gap-2 text-xl font-black text-alarm">
          <TriangleAlert size={28} /> W strefie są jeszcze: {inZone.map((r) => r.label).join(', ')}.
        </p>
      ) : (
        <p className="text-lg">Wszystkie roty wyszły ze strefy. Akcja trafi do historii, skąd możesz wygenerować raport.</p>
      )}
    </Dialog>
  )
}

export function DialogHost() {
  const { dialog } = useOdo()
  if (!dialog) return null
  switch (dialog.type) {
    case 'newRota':
      return <NewRotaDialog />
    case 'assignRA':
      return <AssignRADialog />
    case 'check':
    case 'workpoint':
    case 'exit':
    case 'enterRA':
      return <PressureDialog key={`${dialog.type}-${dialog.rotaId}`} type={dialog.type} rotaId={dialog.rotaId} />
    case 'decision':
      return <DecisionDialog rotaId={dialog.rotaId} manual={dialog.manual} />
    case 'settings':
      return <SettingsDialog />
    case 'endAction':
      return <EndActionDialog />
    default:
      return null
  }
}
