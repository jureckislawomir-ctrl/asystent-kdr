# Asystent KDR

Aplikacja wspierająca Kierującego Działaniem Ratowniczym. Działa w całości offline na tablecie z Androidem.
Reguły projektu i plan kroków: `CLAUDE.md`.

## Stos
React 19 + Vite 8 + Tailwind CSS 4 + vite-plugin-pwa (Workbox) + lucide-react (ikony). Od Kroku 2 dojdzie Dexie.js (IndexedDB).

## Struktura
```
asystent-kdr/
├─ CLAUDE.md                 reguły projektu (prompt z poprawkami)
├─ .github/workflows/        publikacja na GitHub Pages
├─ tools/test_odo_logic.mjs  test wzorów ODO z wykresem WSZP
├─ index.html                motyw ustawiany przed startem (bez błysku w nocy)
├─ vite.config.js            konfiguracja PWA: manifest, Service Worker, aktualizacje na żądanie
├─ public/
│  ├─ favicon.svg
│  └─ icons/                 ikony 192/512, maskable, apple-touch
└─ src/
   ├─ main.jsx, App.jsx      układ: nagłówek + treść + nawigacja
   ├─ index.css              motywy Dzień/Noc (zmienne CSS), ustawienia dotykowe
   ├─ config/modules.js      rejestr modułów (kolejne kroki podpinają się tutaj)
   ├─ lib/storage.js         bezpieczne ustawienia w localStorage
   ├─ hooks/                 motyw, sieć, zegar, Wake Lock, pamięć trwała, routing #/, PWA
   ├─ components/            TopBar, NavBar, UpdateBanner, StatusTile
   └─ modules/
      ├─ pulpit/             Pulpit KDR
      └─ _placeholder/       zaślepka modułów z kroków 2–6
```

## Uruchomienie na komputerze (wymaga Node.js 20+)
```
npm install
npm run dev        # podgląd na żywo (bez trybu offline)
npm run build      # wersja produkcyjna do folderu dist/
npm run preview    # podgląd wersji produkcyjnej z trybem offline
```

## Publikacja
Automatycznie na GitHub Pages po każdym pushu do `main` (`.github/workflows/deploy.yml`): test logiki WSZP → build → publikacja.
Adres: https://jureckislawomir-ctrl.github.io/asystent-kdr/
Lokalny build pod ten sam podkatalog: `BASE_PATH=/asystent-kdr/ npm run build`.
