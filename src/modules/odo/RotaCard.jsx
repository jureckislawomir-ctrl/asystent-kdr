import { TriangleAlert, Timer, Shield } from 'lucide-react'
import { Btn } from '../../components/ui'
import { useOdo } from './OdoContext'
import { useClock } from '../../hooks/useClock'
import { rotaStatus, nextCheckDue, fmtDuration, fmtHM, estimateMinutesToPrognosis } from './logic'
import { removeStandbyRA } from './db'

const STATUS = {
  in: { text: 'W STREFIE', cls: 'border-ok text-ok' },
  withdrawing: { text: 'WYCOFUJE SIĘ', cls: 'border-warn text-warn' },
  standby: { text: 'W GOTOWOŚCI', cls: 'border-line text-fg' },
  out: { text: 'WYSZŁA', cls: 'border-line text-muted' },
}

const STATE_ROW = {
  reached: 'border-alarm text-alarm',
  near: 'border-warn text-warn',
  ok: 'border-line',
  unknown: 'border-line',
}

export function RotaCard({ rota }) {
  const { settings, open } = useOdo()
  const now = useClock().getTime()
  const entry = rota.readings.find((r) => r.type === 'entry')
  const hasWp = rota.readings.some((r) => r.type === 'workpoint')
  const rs = rotaStatus(rota, settings)
  const worst = rs.state
  const due = nextCheckDue(rota, settings.intervalMin)
  const left = due ? due - now : null
  const overdue = left !== null && left <= 0
  const st = STATUS[rota.status]
  // szacunek czasu do WYCOFAJ roty z tempa spadku najniższego ciśnienia
  const est = estimateMinutesToPrognosis(rota, rs.prognosis) ?? undefined

  return (
    <article
      className={`flex flex-col gap-3 rounded-xl border-4 bg-surface p-3 ${
        overdue || worst === 'reached' ? 'border-alarm' : worst === 'near' ? 'border-warn' : 'border-line'
      }`}
    >
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto flex items-center gap-2 text-2xl font-black">
          {rota.kind === 'ra' && <Shield size={24} />}
          {rota.label}
        </h3>
        <span className={`rounded-md border-2 px-2 py-1 text-sm font-black ${st.cls}`}>{st.text}</span>
      </header>

      {entry && (
        <div className="grid grid-cols-2 gap-2">
          <div className={`flex flex-col rounded-lg border-2 px-3 py-2 ${overdue ? 'border-alarm text-alarm' : 'border-line'}`}>
            <span className="flex items-center gap-1 text-sm font-bold uppercase text-muted">
              <Timer size={16} /> {overdue ? 'Kontrola!' : 'Kontrola za'}
            </span>
            <span className="tabular text-4xl font-black leading-tight">
              {left === null ? '—' : overdue ? `+${fmtDuration(-left)}` : fmtDuration(left)}
            </span>
          </div>
          <div className="flex flex-col rounded-lg border-2 border-line px-3 py-2">
            <span className="text-sm font-bold uppercase text-muted">WEJŚCIE {fmtHM(entry.at)}</span>
            <span className="tabular text-4xl font-black leading-tight">
              {fmtDuration((rota.exitAt ?? now) - entry.at)}
            </span>
          </div>
        </div>
      )}

      {entry ? (
        <>
          {/* Rota: najniższe ciśnienie z ostatniej kontroli vs WYCOFAJ roty (dwóch wchodzi, dwóch wychodzi) */}
          <div className={`grid grid-cols-2 gap-2 rounded-lg border-2 border-l-8 px-3 py-2 ${STATE_ROW[worst]}`}>
            <div className="flex flex-col">
              <span className="text-xs font-bold uppercase leading-tight text-muted">
                {{ entry: 'Przy WEJŚCIU', workpoint: 'PRACA', check: 'Ostatnia kontrola' }[rs.lastType] ?? 'Ostatnia kontrola'} {rs.lastAt ? fmtHM(rs.lastAt) : ''}
                <br />
                (najniższe w rocie)
              </span>
              <span className="tabular text-4xl font-black leading-tight">{rs.pressure ?? '—'}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="text-xs font-bold uppercase leading-tight text-muted">
                WYCOFAJ roty
                <br />
                {rs.criticalName ? `(${rs.criticalName})` : ''}
              </span>
              <span className="tabular text-4xl font-black leading-tight">{rs.prognosis ?? '—'}</span>
            </div>
            {worst === 'reached' && <span className="col-span-2 text-base font-black">WYCOFAJ – OSIĄGNIĘTE</span>}
            {worst === 'near' && <span className="col-span-2 text-base font-black">BLISKO WYCOFAJ (+{rs.margin} bar)</span>}
          </div>
          <table className="w-full border-separate border-spacing-y-1 text-left">
            <thead>
              <tr className="align-bottom text-xs font-bold uppercase text-muted">
                <th className="px-2">Ratownik</th>
                <th className="px-1 text-right">WEJŚCIE</th>
                <th className="px-1 text-right">PRACA</th>
                <th className="px-2 text-right">WYCOFAJ</th>
              </tr>
            </thead>
            <tbody>
              {rs.members.map((m, i) => (
                <tr key={i} className="tabular">
                  <td className={`rounded-l-md border-y-2 border-l-8 px-2 py-1 text-lg font-bold ${m.critical ? 'border-fg' : 'border-line'}`}>
                    {m.name || `Ratownik ${i + 1}`}
                  </td>
                  <td className={`border-y-2 px-1 text-right text-lg ${m.critical ? 'border-fg' : 'border-line'}`}>{m.entry ?? '—'}</td>
                  <td className={`border-y-2 px-1 text-right text-lg ${m.critical ? 'border-fg' : 'border-line'}`}>{m.workPoint ?? '—'}</td>
                  <td className={`rounded-r-md border-y-2 border-r-2 px-2 text-right text-2xl font-black ${m.critical ? 'border-fg' : 'border-line'}`}>
                    {m.prognosis ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="text-lg font-bold">{rota.members.filter(Boolean).join(', ') || 'Ratownicy nieokreśleni'}</p>
      )}

      {entry && (
        <p className="text-sm text-muted">
          {hasWp ? 'WYCOFAJ = rezerwa + (WEJŚCIE − PRACA).' : 'Brak PRACY – WYCOFAJ = (WEJŚCIE − rezerwa) ÷ 2 + rezerwa.'}
          {est !== undefined && rota.status !== 'out' && <> · ≈ {Math.round(est)} min do WYCOFAJ (szacunek)</>}
        </p>
      )}

      {rota.status === 'standby' && (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Btn variant="primary" className="min-h-16 text-xl" onClick={() => open('enterRA', { rotaId: rota.id })}>
            WEJŚCIE RA
          </Btn>
          <Btn onClick={() => removeStandbyRA(rota.id)}>Odwołaj</Btn>
        </div>
      )}

      {(rota.status === 'in' || rota.status === 'withdrawing') && (
        <div className="grid grid-cols-2 gap-2">
          <Btn variant="primary" className="col-span-2 min-h-16 text-2xl" onClick={() => open('check', { rotaId: rota.id })}>
            KONTROLA
          </Btn>
          {!hasWp && rota.status === 'in' && <Btn onClick={() => open('workpoint', { rotaId: rota.id })}>PRACA</Btn>}
          {rota.status === 'in' && (
            <Btn variant="warn" onClick={() => open('decision', { rotaId: rota.id, manual: true })}>
              <TriangleAlert size={20} /> Wycofanie
            </Btn>
          )}
          <Btn className={hasWp || rota.status !== 'in' ? 'col-span-2' : ''} onClick={() => open('exit', { rotaId: rota.id })}>
            Wyjście
          </Btn>
        </div>
      )}
    </article>
  )
}

export function RAPlaceholder() {
  const { open } = useOdo()
  return (
    <article className="flex flex-col gap-3 rounded-xl border-4 border-dashed border-warn bg-surface p-3">
      <h3 className="flex items-center gap-2 text-2xl font-black text-warn">
        <Shield size={24} /> Rota asekuracyjna
      </h3>
      <p className="flex items-center gap-2 text-lg font-bold text-warn">
        <TriangleAlert size={22} /> NIEWYZNACZONA
      </p>
      <p className="text-sm text-muted">§ 38 rozporządzenia o BHS – wyznacz rotę asekuracyjną w pełnej gotowości.</p>
      <Btn variant="warn" className="min-h-16 text-xl" onClick={() => open('assignRA')}>
        Wyznacz RA
      </Btn>
    </article>
  )
}

export function OutRow({ rota }) {
  const entry = rota.readings.find((r) => r.type === 'entry')
  const exit = rota.readings.find((r) => r.type === 'exit')
  return (
    <li className="tabular flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border-2 border-line px-3 py-2">
      <span className="text-lg font-black">{rota.label}</span>
      <span>{rota.members.filter(Boolean).join(', ')}</span>
      <span className="text-muted">
        {entry ? fmtHM(entry.at) : '—'} → {exit ? fmtHM(exit.at) : '—'}
        {entry && exit ? ` (${fmtDuration(exit.at - entry.at)})` : ''}
      </span>
      <span className="ml-auto font-bold">wyjście: {exit ? exit.p.join(' / ') : '—'} bar</span>
    </li>
  )
}
