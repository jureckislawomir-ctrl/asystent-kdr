import { LayoutDashboard, Gauge, Droplets, ClipboardList, Map as MapIcon, Biohazard, BookOpenCheck } from 'lucide-react'

// Rejestr modułów. Kolejne kroki podmieniają `ready: false` na gotowy komponent.
export const MODULES = [
  { id: 'pulpit', label: 'Pulpit', title: 'Pulpit KDR', icon: LayoutDashboard, step: 1, ready: true },
  { id: 'odo', label: 'ODO', title: 'Kontrola rot ODO', icon: Gauge, step: 2, ready: true,
    summary: 'Roty w strefie: WEJŚCIE, PRACA, WYCOFAJ (WSZP), kontrola ciśnienia z alarmem, SPOŁEM, dziennik.' },
  { id: 'woda', label: 'Woda', title: 'Zaopatrzenie wodne', icon: Droplets, step: 3, ready: false,
    summary: 'Straty ciśnienia W-52 / W-75 / W-110, różnica wysokości, przetłaczanie i przepompowywanie.' },
  { id: 'dowodzenie', label: 'Dowodzenie', title: 'Tablica dowodzenia', icon: ClipboardList, step: 4, ready: false,
    summary: 'Odcinki bojowe, przydział zastępów, dziennik zdarzeń, meldunki dla SKKP / MSK.' },
  { id: 'mapa', label: 'Mapa', title: 'Mapa i hydranty', icon: MapIcon, step: 5, ready: false,
    summary: 'Mapa rejonu offline, hydranty i punkty czerpania wody, pozycja GPS, pomiar linii wężowych.' },
  { id: 'hazmat', label: 'HAZMAT', title: 'HAZMAT / ADR', icon: Biohazard, step: 6, ready: false,
    summary: 'Wyszukiwarka numerów UN i Kemlera, strefy według zasad ratownictwa chemicznego KSRG.' },
  { id: 'procedury', label: 'Procedury', title: 'Procedury', icon: BookOpenCheck, step: 7, ready: false,
    summary: 'Procedury i listy kontrolne dla KDR – zakres do ustalenia.' },
]

export const DEFAULT_MODULE = 'pulpit'
