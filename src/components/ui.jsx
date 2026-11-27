import { useEffect, useRef } from 'react'
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

/**
 * Duża klawiatura numeryczna (rękawice), 4 kolumny:
 *   1 2 3 −10
 *   4 5 6 +10
 *   7 8 9  ⌫
 *  [300] 0 Dalej
 * onStep(±10) – szybka zmiana ciśnienia; onBase – wstawia wartość bazową (np. 300 przy WEJŚCIU).
 */
export function NumPad({ onDigit, onBackspace, onNext, onStep, onBase, baseLabel, nextLabel = 'Dalej' }) {
  const key = 'flex min-h-16 items-center justify-center rounded-lg border-2 border-line bg-surface text-3xl font-black active:bg-fg active:text-bg'
  const side = `${key} text-2xl`
  const d = (n) => (
    <button key={n} type="button" className={key} onClick={() => onDigit(String(n))}>
      {n}
    </button>
  )
  return (
    <div className="grid grid-cols-4 gap-2">
      {d(1)}{d(2)}{d(3)}
      <button type="button" className={side} onClick={() => onStep?.(-10)} aria-label="Minus 10 bar">−10</button>
      {d(4)}{d(5)}{d(6)}
      <button type="button" className={side} onClick={() => onStep?.(10)} aria-label="Plus 10 bar">+10</button>
      {d(7)}{d(8)}{d(9)}
      <button type="button" className={key} onClick={onBackspace} aria-label="Usuń cyfrę">
        <Delete size={32} />
      </button>
      {onBase ? (
        <button type="button" className={side} onClick={onBase} aria-label={`Wartość bazowa ${baseLabel}`}>
          {baseLabel}
        </button>
      ) : (
        <span />
      )}
      {d(0)}
      <button type="button" className={`${key} col-span-2 text-xl`} onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  )
}

const MAX_BAR = 400

/**
 * Wpisywanie ciśnień kilku ratowników jedną klawiaturą.
 * values: tablica tekstów; active: indeks aktywnego pola; po 3 cyfrach przechodzi do następnego.
 * extra(i): dodatkowa informacja pod polem (np. prognoza, ostrzeżenie).
 * prefill: wartość bazowa (np. 300 przy WEJŚCIU) – pierwsza wpisana cyfra ją zastępuje, ±10 ją zmienia.
 * bases[i]: od czego liczyć ±10, gdy pole jest puste (np. poprzedni odczyt).
 * stacked: pola nad klawiaturą (w poziomie, w oknach dwukolumnowych).
 */
export function PressureFields({ names, values, setValues, active, setActive, extra, prefill = null, bases = [], stacked = false }) {
  // aktualny stan w refach – kolejne stuknięcia nie czekają na odświeżenie ekranu
  const valsRef = useRef(values)
  const activeRef = useRef(active)
  const touchedRef = useRef([])
  useEffect(() => {
    valsRef.current = values
    activeRef.current = active
  }, [values, active])
  const commit = (next, nextActive = activeRef.current) => {
    valsRef.current = next
    activeRef.current = nextActive
    setValues(next)
    setActive(nextActive)
  }
  const setVal = (i, v, nextActive) => commit(names.map((_, k) => (k === i ? v : valsRef.current[k] ?? '')), nextActive)
  const isBase = (i) => prefill !== null && !touchedRef.current[i] && (valsRef.current[i] ?? '') === String(prefill)
  const digit = (d) => {
    const a = activeRef.current
    const cur = isBase(a) ? '' : valsRef.current[a] ?? '' // pierwsza cyfra zastępuje wartość bazową
    touchedRef.current[a] = true
    if (cur.length >= 3) return
    const v = (cur + d).replace(/^0+(?=\d)/, '')
    setVal(a, v, v.length === 3 && a < names.length - 1 ? a + 1 : a)
  }
  const step = (delta) => {
    const a = activeRef.current
    const cur = valsRef.current[a] ?? ''
    const start = cur !== '' ? Number(cur) : Number(bases[a])
    if (!Number.isFinite(start)) return
    touchedRef.current[a] = true
    setVal(a, String(Math.min(MAX_BAR, Math.max(0, start + delta))))
  }
  return (
    <div className={`grid gap-3 md:grid-cols-[1fr_minmax(300px,380px)] ${stacked ? 'landscape:flex landscape:flex-col' : ''}`}>
      <div className="flex flex-col gap-2">
        {names.map((n, i) => (
          <button
            key={i}
            type="button"
            onClick={() => ((activeRef.current = i), setActive(i))}
            className={`flex min-h-16 items-center justify-between gap-3 rounded-lg border-4 px-4 text-left ${
              i === active ? 'border-accent bg-surface' : 'border-line bg-bg'
            }`}
          >
            <span className="flex min-w-0 flex-col">
              <span className="text-lg font-bold">{n || `Ratownik ${i + 1}`}</span>
              {extra && <span className="text-sm text-muted">{extra(i)}</span>}
            </span>
            <span className="tabular min-w-24 shrink-0 text-right text-4xl font-black">
              {values[i] || '—'}
              <span className="ml-1 text-base font-bold text-muted">bar</span>
            </span>
          </button>
        ))}
      </div>
      <NumPad
        onDigit={digit}
        onBackspace={() => {
          const a = activeRef.current
          touchedRef.current[a] = true
          setVal(a, (valsRef.current[a] ?? '').slice(0, -1))
        }}
        onNext={() => commit(valsRef.current, (activeRef.current + 1) % names.length)}
        onStep={step}
        onBase={prefill !== null ? () => ((touchedRef.current[activeRef.current] = false), setVal(activeRef.current, String(prefill))) : undefined}
        baseLabel={prefill}
      />
    </div>
  )
}

/** Godzina zdarzenia: domyślnie „teraz” (albo pierwotna z przywróconego wpisu – base), z korektą ±1 min (nie w przyszłość). */
export function TimeAdjust({ offsetMin, setOffsetMin, label = 'Godzina', base = null }) {
  const at = new Date((base ?? Date.now()) + offsetMin * 60_000)
  const canPlus = at.getTime() + 60_000 <= Date.now()
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-lg font-bold">{label}:</span>
      <span className="tabular text-3xl font-black">
        {at.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="text-sm text-muted">
        {base ? '(pierwotna – z przywróconego wpisu)' : offsetMin === 0 ? '(teraz)' : `(${offsetMin} min)`}
      </span>
      <Btn onClick={() => setOffsetMin(offsetMin - 1)}>−1 min</Btn>
      <Btn onClick={() => setOffsetMin(offsetMin + 1)} disabled={!canPlus}>
        +1 min
      </Btn>
    </div>
  )
}
