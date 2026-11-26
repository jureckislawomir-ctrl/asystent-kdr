import { Download } from 'lucide-react'

// Aktualizacja tylko na żądanie – nigdy samoczynne przeładowanie w trakcie akcji
export default function UpdateBanner({ onUpdate, onLater }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 border-b-2 border-line bg-surface px-3 py-2">
      <Download size={26} className="shrink-0" />
      <p className="mr-auto font-bold">
        Dostępna nowa wersja aplikacji. Zaktualizuj, gdy nie trwa akcja (aplikacja uruchomi się ponownie).
      </p>
      <button type="button" onClick={onLater} className="min-h-14 rounded-lg border-2 border-line px-4 font-bold">
        Później
      </button>
      <button
        type="button"
        onClick={onUpdate}
        className="min-h-14 rounded-lg border-2 border-accent bg-accent px-4 font-bold text-accent-fg"
      >
        Aktualizuj teraz
      </button>
    </div>
  )
}
