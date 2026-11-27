import { TriangleAlert, Timer, Shield } from 'lucide-react'
import { Btn } from '../../components/ui'
import { useOdo } from './OdoContext'
import { useClock } from '../../hooks/useClock'
import { rotaStatus, nextCheckDue, fmtDuration, fmtHM } from './logic'
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

// Liczby rosną z wysokością ekranu (karta wypełnia ekran), ale mieszczą się w szerokości karty:
// poziom – 4 karty obok siebie, pion – 2.
// W poziomie (wąskie karty) etykieta nad liczbą, liczba do prawej; w pionie – obok siebie.
const BIG_NUM = 'text-5xl landscape:text-[max(2.75rem,min(9vh,5.6vw))] portrait:text-[max(3rem,min(5vh,7vw))]'
const BIG_TIMER = 'text-4xl landscape:text-[max(2.25rem,min(7vh,4.4vw))] portrait:text-[max(2.25rem,min(3.6vh,5.5vw))]'

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
  const names = rota.members.filter(Boolean).join(' · ') || 'Ratownicy nieokreśleni'
  const active = rota.status === 'in' || rota.status === 'withdrawing'

  return (
    <article
      className={`flex flex-col gap-2 rounded-xl border-4 bg-surface p-2 ${
        overdue || worst === 'reached' ? 'border-alarm' : worst === 'near' ? 'border-warn' : 'border-line'
      }`}
    >
      <header className="flex items-start gap-2">
        <div className="mr-auto min-w-0">
          <h3 className="flex items-center gap-1 text-2xl font-black leading-tight">
            {rota.kind === 'ra' && <Shield size={22} className="shrink-0" />}
            <span className="truncate">{rota.label}</span>
          </h3>
          <p className="truncate text-sm font-bold text-muted">{names}</p>
        </div>
        <span className={`shrink-0 rounded-md border-2 px-1.5 py-0.5 text-xs font-black ${st.cls}`}>{st.text}</span>
      </header>

      {entry && (
        <>
          {/* minutnik kontroli */}
          <div className={`flex flex-1 items-center justify-between rounded-lg border-2 px-3 py-1 landscape:flex-col landscape:items-stretch landscape:justify-center ${overdue ? 'border-4 border-alarm text-alarm' : 'border-line'}`}>
            <span className="flex items-center gap-1 text-sm font-black uppercase">
              <Timer size={18} /> {overdue ? 'Kontrola!' : 'Kontrola za'}
            </span>
            <span className={`tabular text-right font-black leading-none ${BIG_TIMER}`}>
              {left === null ? '—' : overdue ? `+${fmtDuration(-left)}` : fmtDuration(left)}
            </span>
          </div>

          {/* najniższe ciśnienie w rocie vs WYCOFAJ roty (dwóch wchodzi, dwóch wychodzi) */}
          <div className={`grid flex-[2] grid-cols-2 content-center gap-y-2 rounded-lg border-2 border-l-8 px-2 py-1 landscape:grid-cols-1 ${STATE_ROW[worst]}`}>
            <div className="flex flex-col landscape:text-right">
              <span className="text-xs font-black uppercase text-muted landscape:text-left">Najniższe</span>
              <span className={`tabular font-black leading-none ${BIG_NUM}`}>{rs.pressure ?? '—'}</span>
            </div>
            <div className="flex flex-col text-right">
              <span className="truncate text-xs font-black uppercase text-muted landscape:text-left">WYCOFAJ</span>
              <span className={`tabular font-black leading-none ${BIG_NUM}`}>{rs.prognosis ?? '—'}</span>
            </div>
            {worst === 'reached' && <span className="col-span-2 text-base font-black landscape:col-span-1">WYCOFAJ – OSIĄGNIĘTE</span>}
            {worst === 'near' && <span className="col-span-2 text-base font-black landscape:col-span-1">BLISKO WYCOFAJ (+{rs.margin})</span>}
          </div>

          <p className="tabular text-sm font-bold text-muted">
            WEJŚCIE {fmtHM(entry.at)} · w strefie {fmtDuration((rota.exitAt ?? now) - entry.at)}
          </p>
        </>
      )}

      {rota.status === 'standby' && (
        <div className="mt-auto grid gap-2">
          <Btn variant="primary" className="min-h-16 text-xl" onClick={() => open('enterRA', { rotaId: rota.id })}>
            WEJŚCIE RA
          </Btn>
          <Btn onClick={() => removeStandbyRA(rota.id)}>Odwołaj</Btn>
        </div>
      )}

      {active && (
        <div className="mt-auto grid grid-cols-2 gap-2">
          <Btn variant="primary" className="col-span-2 min-h-16 text-2xl" onClick={() => open('check', { rotaId: rota.id })}>
            KONTROLA
          </Btn>
          {!hasWp && rota.status === 'in' && <Btn className="px-2" onClick={() => open('workpoint', { rotaId: rota.id })}>PRACA</Btn>}
          <Btn className={`px-2 ${!hasWp && rota.status === 'in' ? '' : rota.status === 'in' ? '' : 'col-span-2'}`} onClick={() => open('exit', { rotaId: rota.id })}>
            Wyjście
          </Btn>
          {rota.status === 'in' && (
            <Btn variant="warn" className={`px-2 ${!hasWp ? 'col-span-2' : ''}`} onClick={() => open('decision', { rotaId: rota.id, manual: true })}>
              <TriangleAlert size={20} /> Wycofanie
            </Btn>
          )}
        </div>
      )}
    </article>
  )
}

export function RAPlaceholder() {
  const { open } = useOdo()
  return (
    <article className="flex flex-col gap-2 rounded-xl border-4 border-dashed border-warn bg-surface p-2">
      <h3 className="flex items-center gap-1 text-2xl font-black leading-tight text-warn">
        <Shield size={22} /> RA
      </h3>
      <p className="flex items-center gap-2 text-lg font-black text-warn">
        <TriangleAlert size={22} /> NIEWYZNACZONA
      </p>
      <p className="text-sm text-muted">Rota asekuracyjna – § 38 BHS</p>
      <Btn variant="warn" className="mt-auto min-h-16 text-xl" onClick={() => open('assignRA')}>
        Wyznacz RA
      </Btn>
    </article>
  )
}

/** Rota po wyjściu – krótki znacznik (szczegóły w raporcie). */
export function OutRow({ rota }) {
  const entry = rota.readings.find((r) => r.type === 'entry')
  const exit = rota.readings.find((r) => r.type === 'exit')
  return (
    <li className="tabular flex items-center gap-2 rounded-lg border-2 border-line px-3 py-1">
      <span className="font-black">{rota.label}</span>
      <span className="text-sm text-muted">
        {entry && exit ? `${fmtHM(exit.at)} · ${fmtDuration(exit.at - entry.at)}` : exit ? fmtHM(exit.at) : ''}
      </span>
    </li>
  )
}
