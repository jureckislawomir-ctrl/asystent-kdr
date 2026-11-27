import { prognosis, fmtHM, fmtDuration, readingMin, workPointOf, isRotaWorkPoint, rotaStatus } from './logic'

const fmtDate = (ms) => new Date(ms).toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Tekstowy raport kontroli ODO (do udostępnienia: e-mail, komunikator, notatka). */
export function buildReportText(action, rotas, events) {
  const s = action.settings
  const L = []
  L.push(`RAPORT KONTROLI ODO – ${fmtDate(action.startedAt)}`)
  L.push(`Czas: ${fmtHM(action.startedAt)}–${action.endedAt ? fmtHM(action.endedAt) : 'w toku'}`)
  L.push(`Metodyka WSZP: rezerwa ${s.reserve} bar, kontrola co ${s.intervalMin} min.`)
  L.push('')
  for (const r of rotas) {
    const entry = r.readings.find((x) => x.type === 'entry')
    const wp = r.readings.find((x) => x.type === 'workpoint')
    const exit = r.readings.find((x) => x.type === 'exit')
    L.push(`${r.kind === 'ra' ? '[RA] ' : ''}${r.label}${r.members.filter(Boolean).length ? ` – ${r.members.filter(Boolean).join(', ')}` : ''}`)
    if (!entry) {
      L.push('  bez WEJŚCIA do strefy')
      L.push('')
      continue
    }
    const rotaWp = isRotaWorkPoint(wp)
    r.members.forEach((m, i) => {
      const prog = prognosis(entry.p[i], workPointOf(wp, i), s.reserve)
      L.push(
        `  ${m || `Ratownik ${i + 1}`}: WEJŚCIE ${entry.p[i]} bar${rotaWp ? '' : `, PRACA ${wp ? wp.p[i] : '—'}, WYCOFAJ ${prog}`}, wyjście ${exit ? exit.p[i] : '—'} bar`,
      )
    })
    if (rotaWp) L.push(`  PRACA ${wp.p[0]} bar (najniższe w rocie), WYCOFAJ roty ${rotaStatus(r, s).prognosis} bar`)
    L.push(`  WEJŚCIE ${fmtHM(entry.at)}${wp ? `, PRACA ${fmtHM(wp.at)}` : ''}${exit ? `, wyjście ${fmtHM(exit.at)} (w strefie ${fmtDuration(exit.at - entry.at)})` : ', w strefie'}`)
    const checks = r.readings.filter((x) => x.type === 'check')
    if (checks.length) L.push(`  Kontrole (najniższe w rocie): ${checks.map((c) => `${fmtHM(c.at)} ${readingMin(c)}`).join('; ')}`)
    L.push('')
  }
  L.push('DZIENNIK')
  for (const e of events) L.push(`${fmtHM(e.at)}  ${e.text}`)
  L.push('')
  L.push('Wygenerowano w aplikacji Asystent KDR (zapis pomocniczy).')
  return L.join('\n')
}
