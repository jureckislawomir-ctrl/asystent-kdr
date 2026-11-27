// Test logiki ODO z wykresem prognozowania WSZP (str. 15/20 „Zbioru dobrych praktyk…”, KW PSP Poznań 2023).
// Wartości przepisane ręcznie z wykresu. Uruchom: node tools/test_odo_logic.mjs
import { prognosis, memberState, nextCheckDue, estimateMinutesToPrognosis, rotaStatus, readingMin } from '../src/modules/odo/logic.js'

const COLS = [330, 320, 310, 300, 290, 280, 270] // ciśnienie wejścia
const CHART = {
  // ciśnienie w punkcie pracy: prognozowane ciśnienie wycofania (null = pole puste)
  330: [60],
  320: [70, 60],
  310: [80, 70, 60],
  300: [90, 80, 70, 60],
  290: [100, 90, 80, 70, 60],
  280: [110, 100, 90, 80, 70, 60],
  270: [120, 110, 100, 90, 80, 70, 60],
  260: [130, 120, 110, 100, 90, 80, 70],
  250: [140, 130, 120, 110, 100, 90, 80],
  240: [150, 140, 130, 120, 110, 100, 90],
  230: [160, 150, 140, 130, 120, 110, 100],
  220: [170, 160, 150, 140, 130, 120, 110],
  210: [180, 170, 160, 150, 140, 130, 120],
  200: [190, 180, 170, 160, 150, 140, 130],
  190: [null, 190, 180, 170, 160, 150, 140],
  180: [null, null, null, 180, 170, 160, 150],
  170: [null, null, null, null, null, 170, 160],
}
// czerwone pola na dole kolumn = brak punktu pracy (wykres zaokrągla w dół do 10 bar, ±5)
const NO_WP = { 330: 190, 320: 190, 310: 180, 300: 180, 290: 170, 280: 170, 270: 160 }

let ok = 0
let fail = 0
const check = (cond, msg) => (cond ? ok++ : (fail++, console.log('BŁĄD:', msg)))

for (const [wp, row] of Object.entries(CHART)) {
  row.forEach((v, c) => {
    if (v === null) return
    const got = prognosis(COLS[c], Number(wp), 60)
    check(got === v, `wejście ${COLS[c]}, punkt pracy ${wp}: wykres ${v}, aplikacja ${got}`)
  })
}
for (const [entry, v] of Object.entries(NO_WP)) {
  const got = prognosis(Number(entry), null, 60)
  check(got - v >= 0 && got - v <= 5, `brak punktu pracy, wejście ${entry}: wykres ${v} (±5), aplikacja ${got}`)
}
// przykłady z dokumentu
check(prognosis(300, null, 60) === 180, 'przykład (300−60)/2+60 = 180')
check(prognosis(310, 270, 60) === 100 && prognosis(300, 250, 60) === 110, 'przykład Michał/Paweł 100/110')
// stany
check(memberState(120, 110, 10) === 'near', 'Paweł 120/110 = blisko')
check(memberState(121, 110, 10) === 'ok', '121/110 = ok')
check(memberState(110, 110, 10) === 'reached', '110/110 = osiągnięta')
// minutnik
const t0 = Date.UTC(2026, 10, 26, 12, 45)
const rota = { status: 'in', readings: [{ type: 'entry', at: t0, p: [310, 300] }] }
check(nextCheckDue(rota, 5) === t0 + 5 * 60_000, 'kontrola 5 min po wejściu')
check(nextCheckDue({ ...rota, snoozeUntil: t0 + 6 * 60_000 }, 5) === t0 + 6 * 60_000, 'odłożenie kontroli')
check(nextCheckDue({ ...rota, status: 'out' }, 5) === null, 'brak minutnika po wyjściu')
// szacunek: 300 → 250 w 10 min = 5 bar/min, do prognozy 110 zostaje 140 bar = 28 min
const r2 = { readings: [{ at: t0, p: [300] }, { at: t0 + 10 * 60_000, p: [250] }] }
check(Math.round(estimateMinutesToPrognosis(r2, 110)) === 28, 'szacunek czasu 28 min')

// zasada „dwóch wchodzi, dwóch wychodzi”: WYCOFAJ roty = najwyższa prognoza, kontrola = najniższe ciśnienie
const S = { reserve: 60, marginBar: 10 }
const base = { members: ['Michał', 'Paweł'], readings: [
  { type: 'entry', at: t0, p: [310, 300] },
  { type: 'workpoint', at: t0 + 6 * 60_000, p: [270, 250] },
] }
const withCheck = (p) => ({ ...base, readings: [...base.readings, { type: 'check', at: t0 + 15 * 60_000, p }] })
let rs = rotaStatus(withCheck([121]), S)
check(rs.prognosis === 110 && rs.criticalName === 'Paweł', 'WYCOFAJ roty = 110 (Paweł – najwyższa prognoza z 100/110)')
check(rs.state === 'ok', 'kontrola 121 → powyżej WYCOFAJ')
check(rotaStatus(withCheck([120]), S).state === 'near', 'kontrola 120 → blisko WYCOFAJ')
check(rotaStatus(withCheck([110]), S).state === 'reached', 'kontrola 110 → WYCOFAJ osiągnięte')
check(rotaStatus(base, S).pressure === 250, 'po PRACY ciśnienie roty = najniższe z dwóch (250)')
check(readingMin({ p: [130, 120] }) === 120, 'stary wpis kontroli z dwoma polami → najniższe 120')
check(rotaStatus({ members: ['A', 'B'], readings: [{ type: 'entry', at: t0, p: [300, 280] }] }, S).prognosis === 180,
  'bez PRACY: WYCOFAJ roty = max(180, 170) = 180')

console.log(`Wynik: ${ok} poprawnych, ${fail} błędów`)
process.exit(fail ? 1 : 0)
