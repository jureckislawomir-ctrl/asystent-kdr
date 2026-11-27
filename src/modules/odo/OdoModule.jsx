import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, ScrollText, Settings, Flag, History, ArrowLeft, Share2, Printer, Trash2, FileText, Gauge } from 'lucide-react'
import { Btn, Dialog } from '../../components/ui'
import { useOdo } from './OdoContext'
import { RotaCard, RAPlaceholder, OutRow } from './RotaCard'
import { db, deleteAction } from './db'
import { ACTIVE_STATUSES, fmtHM, prognosis } from './logic'
import { buildReportText } from './report'
import { notificationStatus, requestNotifications } from './dialogs'

export default function OdoModule() {
  const [view, setView] = useState({ name: 'board' }) // board | journal | history | report
  if (view.name === 'journal') return <Journal onBack={() => setView({ name: 'board' })} />
  if (view.name === 'history') return <HistoryList onBack={() => setView({ name: 'board' })} onOpen={(id) => setView({ name: 'report', id, from: 'history' })} />
  if (view.name === 'report') return <Report actionId={view.id} onBack={() => setView({ name: view.from })} />
  return <Board setView={setView} />
}

function Board({ setView }) {
  const { action, rotas, settings, open } = useOdo()
  const entryAt = (r) => r.readings.find((x) => x.type === 'entry')?.at ?? Infinity
  const active = rotas.filter((r) => ACTIVE_STATUSES.includes(r.status)).sort((a, b) => entryAt(a) - entryAt(b))
  const standbyRA = rotas.filter((r) => r.status === 'standby')
  const out = rotas.filter((r) => r.status === 'out')
  const people = active.reduce((n, r) => n + r.members.length, 0)

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="mr-auto flex flex-col">
          <h1 className="flex items-center gap-2 text-2xl font-black">
            <Gauge size={28} /> Kontrola rot ODO
          </h1>
          <span className="text-sm text-muted">
            {action ? `Od ${fmtHM(action.startedAt)} · ` : ''}rezerwa {settings.reserve} bar · kontrola co {settings.intervalMin} min
            {action ? ` · w strefie: ${active.length} rot, ${people} os.` : ''}
          </span>
        </div>
        <Btn variant="primary" className="text-xl" onClick={() => open('newRota')}>
          <Plus size={24} /> Rota
        </Btn>
        {action && (
          <>
            <Btn onClick={() => setView({ name: 'journal' })}>
              <ScrollText size={22} /> Dziennik
            </Btn>
            <Btn onClick={() => setView({ name: 'report', id: action.id, from: 'board' })}>
              <FileText size={22} /> Raport
            </Btn>
          </>
        )}
        <Btn onClick={() => open('settings')} aria-label="Ustawienia">
          <Settings size={22} />
        </Btn>
        {action ? (
          <Btn variant="warn" onClick={() => open('endAction')}>
            <Flag size={22} /> Zakończ
          </Btn>
        ) : (
          <Btn onClick={() => setView({ name: 'history' })}>
            <History size={22} /> Historia
          </Btn>
        )}
      </div>

      <NotificationHint />

      {!action && (
        <div className="rounded-xl border-2 border-line bg-surface p-5">
          <p className="text-xl font-black">Brak aktywnej kontroli ODO.</p>
          <p className="mt-1 text-muted">
            Dodaj pierwszą rotę przyciskiem „+ Rota” – kontrola rozpocznie się automatycznie. Rotę asekuracyjną możesz wyznaczyć przed WEJŚCIEM pierwszej roty.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn variant="primary" className="min-h-16 text-xl" onClick={() => open('newRota')}>
              <Plus size={24} /> Nowa rota – WEJŚCIE
            </Btn>
            <Btn className="min-h-16" onClick={() => open('assignRA')}>
              Wyznacz rotę asekuracyjną
            </Btn>
          </div>
        </div>
      )}

      {(action || standbyRA.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {active.map((r) => (
            <RotaCard key={r.id} rota={r} />
          ))}
          {standbyRA.map((r) => (
            <RotaCard key={r.id} rota={r} />
          ))}
          {standbyRA.length === 0 && <RAPlaceholder />}
        </div>
      )}

      {out.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-black text-muted">Wyszły ze strefy</h2>
          <ul className="flex flex-col gap-2">
            {out.map((r) => (
              <OutRow key={r.id} rota={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function NotificationHint() {
  const [st, setSt] = useState(notificationStatus)
  if (st !== 'default') return null
  return (
    <div className="no-print flex flex-wrap items-center gap-3 rounded-lg border-2 border-warn px-3 py-2">
      <span className="mr-auto font-bold text-warn">
        Powiadomienia wyłączone – gdy aplikacja jest w tle, alarm kontroli może nie dotrzeć.
      </span>
      <Btn variant="warn" onClick={async () => setSt(await requestNotifications())}>
        Włącz powiadomienia
      </Btn>
    </div>
  )
}

const EVENT_STYLE = {
  decision_continue: 'border-alarm text-alarm',
  decision_withdraw: 'border-warn text-warn',
  decision_informed: 'border-warn',
  entry: 'border-ok',
  exit: 'border-line',
}

function EventList({ events }) {
  return (
    <ol className="flex flex-col gap-1">
      {events.map((e) => (
        <li key={e.id} className={`tabular flex gap-3 rounded-md border-l-8 bg-surface px-3 py-2 ${EVENT_STYLE[e.type] ?? 'border-line'}`}>
          <span className="w-14 shrink-0 font-black">{fmtHM(e.at)}</span>
          <span>{e.text}</span>
        </li>
      ))}
    </ol>
  )
}

function Journal({ onBack }) {
  const { action } = useOdo()
  const events = useLiveQuery(() => (action ? db.events.where('actionId').equals(action.id).reverse().sortBy('at') : []), [action?.id], [])
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <Btn onClick={onBack}>
          <ArrowLeft size={22} /> Tablica
        </Btn>
        <h1 className="text-2xl font-black">Dziennik kontroli ODO</h1>
      </div>
      <p className="text-sm text-muted">Najnowsze na górze. Wpisów nie można usuwać – korekta to nowy wpis.</p>
      <EventList events={events} />
    </div>
  )
}

function HistoryList({ onBack, onOpen }) {
  const actions = useLiveQuery(() => db.actions.filter((a) => !!a.endedAt).reverse().sortBy('startedAt'), [], [])
  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2">
        <Btn onClick={onBack}>
          <ArrowLeft size={22} /> Tablica
        </Btn>
        <h1 className="text-2xl font-black">Historia kontroli ODO</h1>
      </div>
      <p className="text-sm text-muted">Zakończone akcje są przechowywane 90 dni, potem usuwane automatycznie (RODO). Wyeksportuj raport po akcji.</p>
      {actions.length === 0 && <p className="text-lg">Brak zakończonych akcji.</p>}
      <ul className="flex flex-col gap-2">
        {actions.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              onClick={() => onOpen(a.id)}
              className="tabular flex min-h-16 w-full items-center gap-4 rounded-lg border-2 border-line bg-surface px-4 text-left active:bg-fg active:text-bg"
            >
              <span className="text-xl font-black">{new Date(a.startedAt).toLocaleDateString('pl-PL')}</span>
              <span className="text-lg">
                {fmtHM(a.startedAt)}–{fmtHM(a.endedAt)}
              </span>
              <span className="ml-auto font-bold">Raport →</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Report({ actionId, onBack }) {
  const data = useLiveQuery(async () => {
    const action = await db.actions.get(actionId)
    if (!action) return null
    const rotas = await db.rotas.where('actionId').equals(actionId).sortBy('createdAt')
    const events = await db.events.where('actionId').equals(actionId).sortBy('at')
    return { action, rotas, events }
  }, [actionId])
  const [confirmDel, setConfirmDel] = useState(false)
  const [msg, setMsg] = useState('')
  if (data === undefined) return null
  if (data === null) return <div className="p-4"><Btn onClick={onBack}>← Wróć</Btn><p className="mt-3">Akcja została usunięta.</p></div>

  const { action, rotas, events } = data
  const text = buildReportText(action, rotas, events)
  const s = action.settings

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Raport kontroli ODO', text })
      else {
        await navigator.clipboard.writeText(text)
        setMsg('Skopiowano raport do schowka.')
      }
    } catch {
      /* anulowano */
    }
  }

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="no-print flex flex-wrap items-center gap-2">
        <Btn onClick={onBack}>
          <ArrowLeft size={22} /> Wróć
        </Btn>
        <span className="mr-auto" />
        <Btn variant="primary" onClick={share}>
          <Share2 size={22} /> Udostępnij
        </Btn>
        <Btn onClick={() => window.print()}>
          <Printer size={22} /> Drukuj / PDF
        </Btn>
        {action.endedAt && (
          <Btn variant="warn" onClick={() => setConfirmDel(true)}>
            <Trash2 size={22} /> Usuń
          </Btn>
        )}
      </div>
      {msg && <p className="no-print font-bold text-ok">{msg}</p>}

      <section className="print-area flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-black">Raport kontroli ODO</h1>
          <p className="tabular text-lg">
            {new Date(action.startedAt).toLocaleDateString('pl-PL')} · {fmtHM(action.startedAt)}–{action.endedAt ? fmtHM(action.endedAt) : 'w toku'} · rezerwa {s.reserve} bar · kontrola co {s.intervalMin} min (WSZP)
          </p>
        </div>

        {[...rotas].sort((a, b) => (a.readings[0]?.at ?? Infinity) - (b.readings[0]?.at ?? Infinity)).map((r) => {
          const entry = r.readings.find((x) => x.type === 'entry')
          const wp = r.readings.find((x) => x.type === 'workpoint')
          const exit = r.readings.find((x) => x.type === 'exit')
          const checks = r.readings.filter((x) => x.type === 'check')
          return (
            <div key={r.id} className="break-inside-avoid">
              <h2 className="text-xl font-black">
                {r.kind === 'ra' && r.label !== 'RA' ? 'RA · ' : ''}
                {r.label}
                {r.kind === 'ra' && r.label === 'RA' ? ' (rota asekuracyjna)' : ''}
              </h2>
              {entry ? (
                <div className="overflow-x-auto">
                  <table className="tabular w-full border-collapse text-left">
                    <thead>
                      <tr className="text-sm">
                        <th className="border-2 border-line px-2">Ratownik</th>
                        <th className="border-2 border-line px-2">WEJŚCIE {fmtHM(entry.at)}</th>
                        <th className="border-2 border-line px-2">PRACA {wp ? fmtHM(wp.at) : ''}</th>
                        <th className="border-2 border-line px-2">WYCOFAJ</th>
                        {checks.map((c, k) => (
                          <th key={k} className="border-2 border-line px-2">Kontrola {fmtHM(c.at)}</th>
                        ))}
                        <th className="border-2 border-line px-2">Wyjście {exit ? fmtHM(exit.at) : ''}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.members.map((m, i) => (
                        <tr key={i}>
                          <td className="border-2 border-line px-2 font-bold">{m || `Ratownik ${i + 1}`}</td>
                          <td className="border-2 border-line px-2">{entry.p[i]}</td>
                          <td className="border-2 border-line px-2">{wp ? wp.p[i] : '—'}</td>
                          <td className="border-2 border-line px-2 font-black">{prognosis(entry.p[i], wp?.p[i], s.reserve)}</td>
                          {checks.map((c, k) => (
                            <td key={k} className="border-2 border-line px-2">{c.p[i]}</td>
                          ))}
                          <td className="border-2 border-line px-2">{exit ? exit.p[i] : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted">Bez WEJŚCIA do strefy.</p>
              )}
            </div>
          )
        })}

        <div>
          <h2 className="mb-2 text-xl font-black">Dziennik</h2>
          <EventList events={events} />
        </div>
        <p className="text-sm text-muted">Zapis pomocniczy z aplikacji Asystent KDR – nie zastępuje dokumentacji ze zdarzenia.</p>
      </section>

      {confirmDel && (
        <Dialog
          title="Usunąć akcję z tabletu?"
          onClose={() => setConfirmDel(false)}
          footer={
            <Btn variant="primary" onClick={async () => (await deleteAction(action.id), setConfirmDel(false), onBack())}>
              USUŃ NA ZAWSZE
            </Btn>
          }
        >
          <p className="text-lg">Raportu nie będzie można odzyskać. Upewnij się, że został wyeksportowany.</p>
        </Dialog>
      )}
    </div>
  )
}
