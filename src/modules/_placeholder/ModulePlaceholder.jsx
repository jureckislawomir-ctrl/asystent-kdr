import { Construction } from 'lucide-react'

// Zaślepka dla modułów z kolejnych kroków
export default function ModulePlaceholder({ module, onNavigate }) {
  const Icon = module.icon
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 p-6">
      <div className="flex items-center gap-4">
        <Icon size={56} />
        <h1 className="text-4xl font-black">{module.title}</h1>
      </div>
      <p className="flex items-center gap-2 rounded-lg border-2 border-line bg-surface px-4 py-3 text-xl font-bold">
        <Construction size={28} /> Moduł w przygotowaniu – Krok {module.step}
      </p>
      <p className="text-lg text-muted">{module.summary}</p>
      <button
        type="button"
        onClick={() => onNavigate('pulpit')}
        className="min-h-14 rounded-lg border-2 border-line px-5 text-lg font-bold active:bg-fg active:text-bg"
      >
        Wróć do pulpitu
      </button>
    </div>
  )
}
