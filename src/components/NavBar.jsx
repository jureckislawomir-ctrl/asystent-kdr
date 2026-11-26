import { MODULES } from '../config/modules'

// Pion: pasek na dole. Poziom (typowe ustawienie tabletu w samochodzie): pasek z lewej.
export default function NavBar({ route, onNavigate }) {
  return (
    <nav
      aria-label="Moduły"
      className="order-last flex border-t-2 border-line bg-bg pb-[env(safe-area-inset-bottom)] landscape:order-first landscape:w-28 landscape:flex-col landscape:border-t-0 landscape:border-r-2 landscape:pb-0"
    >
      {MODULES.map(({ id, label, icon: Icon, ready }) => {
        const active = id === route
        return (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            aria-current={active ? 'page' : undefined}
            className={`relative flex min-h-[72px] flex-1 flex-col items-center justify-center gap-1 px-1 text-sm font-bold uppercase landscape:min-h-0 ${
              active ? 'bg-fg text-bg' : 'text-fg active:bg-surface'
            } ${ready || active ? '' : 'opacity-70'}`}
          >
            {/* znacznik aktywnej zakładki – ramka, nie tylko kolor */}
            {active && (
              <span className="absolute inset-x-0 top-0 h-1.5 bg-accent landscape:inset-x-auto landscape:inset-y-0 landscape:left-0 landscape:h-auto landscape:w-1.5" />
            )}
            <Icon size={30} strokeWidth={2.25} />
            <span className="leading-none">{label}</span>
          </button>
        )
      })}
    </nav>
  )
}
