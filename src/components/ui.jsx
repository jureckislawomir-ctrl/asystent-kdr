import { Delete } from 'lucide-react'

// Wspólne elementy „bojowe”: duże cele dotykowe, stan opisany tekstem, nie tylko kolorem.

const VARIANT = {
  default: 'border-line bg-surface text-fg',
  primary: 'border-accent bg-accent text-accent-fg',
  warn: 'border-warn bg-surface text-warn',
  ghost: 'border-line bg-bg text-fg',
}

export function Btn({ variant = 'default', className = '', children, ...rest }) {
  return (
    <button
      type="button"
      {...rest}
      className={`flex min-h-14 items-center justify-center gap-2 rounded-lg border-2 px-4 text-lg font-bold active:bg-fg active:text-bg disabled:opacity-40 ${VARIANT[variant]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Dialog({ title, onClose, children, footer, wide = false }) {
  return (
    <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-black/70 p-2 sm:items-center sm:p-4" role="dialog" aria-label={title}>
      <div className={`flex max-h-full w-full flex-col rounded-xl border-2 border-line bg-bg ${wide ? 'max-w-5xl' : 'max-w-3xl'}`}>
        <div className="flex items-center gap-3 border-b-2 border-line px-4 py-2">
          <h2 className="mr-auto text-2xl font-black">{title}</h2>
          {onClose && (
            <Btn variant="ghost" onClick={onClose} aria-label="Zamknij">
              Anuluj
            </Btn>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-3 border-t-2 border-line px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

/** Duża klawiatura numeryczna (rękawice). */
export function NumPad({ onDigit, onBackspace, onNext, nextLabel = 'Dalej' }) {
  const key = 'flex min-h-16 items-center justify-center rounded-lg border-2 border-line bg-surface text-3xl font-black active:bg-fg active:text-bg'
  return (
    <div className="grid grid-cols-3 gap-2">
      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
        <button key={d} type="button" className={key} onClick={() => onDigit(String(d))}>
          {d}
        </button>
      ))}
      <button type="button" className={key} onClick={onBackspace} aria-label="Usuń cyfrę">
        <Delete size={32} />
      </button>
      <button type="button" className={key} onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" className={`${key} text-xl`} onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  )
}

/**
 * Wpisywanie ciśnień kilku ratowników jedną klawiaturą.
 * values: tablica tekstów; active: indeks aktywnego pola; po 3 cyfrach przechodzi do następnego.
 * extra(i): dodatkowa informacja pod polem (np. prognoza, ostrzeżenie).
 */
export function PressureFields({ names, values, setValues, active, setActive, extra }) {
  const setVal = (i, v) => setValues(values.map((x, k) => (k === i ? v : x)))
  const digit = (d) => {
    const cur = values[active] ?? ''
    if (cur.length >= 3) return
    const v = (cur + d).replace(/^0+(?=\d)/, '')
    setVal(active, v)
    if (v.length === 3 && active < names.length - 1) setActive(active + 1)
  }
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_minmax(260px,340px)]">
      <div className="flex flex-col gap-2">
        {names.map((n, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={`flex min-h-16 items-center justify-between gap-3 rounded-lg border-4 px-4 text-left ${
              i === active ? 'border-accent bg-surface' : 'border-line bg-bg'
            }`}
          >
            <span className="flex flex-col">
              <span className="text-lg font-bold">{n || `Ratownik ${i + 1}`}</span>
              {extra && <span className="text-sm text-muted">{extra(i)}</span>}
            </span>
            <span className="tabular min-w-24 text-right text-4xl font-black">
              {values[i] || '—'}
              <span className="ml-1 text-base font-bold text-muted">bar</span>
            </span>
          </button>
        ))}
      </div>
      <NumPad
        onDigit={digit}
        onBackspace={() => setVal(active, (values[active] ?? '').slice(0, -1))}
        onNext={() => setActive((active + 1) % names.length)}
      />
    </div>
  )
}

/** Godzina zdarzenia: domyślnie „teraz”, z korektą ±1 min (nie w przyszłość). */
export function TimeAdjust({ offsetMin, setOffsetMin, label = 'Godzina' }) {
  const at = new Date(Date.now() + offsetMin * 60_000)
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-lg font-bold">{label}:</span>
      <span className="tabular text-3xl font-black">
        {at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="text-sm text-muted">{offsetMin === 0 ? '(teraz)' : `(${offsetMin} min)`}</span>
      <Btn onClick={() => setOffsetMin(offsetMin - 1)}>−1 min</Btn>
      <Btn onClick={() => setOffsetMin(Math.min(0, offsetMin + 1))} disabled={offsetMin >= 0}>
        +1 min
      </Btn>
    </div>
  )
}
