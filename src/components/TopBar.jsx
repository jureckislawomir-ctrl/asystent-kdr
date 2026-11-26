import { Lock, Sun, Moon, Wifi, WifiOff, Eye, EyeOff, CircleCheck, CircleAlert, HardDrive, TriangleAlert } from 'lucide-react'
import { useClock, fmtTime } from '../hooks/useClock'

const TONE = {
  ok: 'border-ok text-ok',
  warn: 'border-warn text-warn',
  neutral: 'border-line text-fg',
}

// Wskaźnik / przycisk w nagłówku. Stan zawsze rozróżnia też ikona (nie tylko kolor);
// napis widoczny na szerokim ekranie (tablet w poziomie), w pionie same ikony.
function Chip({ icon: Icon, label, tone = 'neutral', description, onClick, pressed }) {
  const cls = `flex min-h-14 min-w-14 items-center justify-center gap-2 rounded-lg border-2 bg-surface px-3 font-bold ${TONE[tone]}`
  const content = (
    <>
      <Icon size={26} className="shrink-0" />
      <span className="hidden whitespace-nowrap lg:inline">{label}</span>
    </>
  )
  if (onClick)
    return (
      <button type="button" onClick={onClick} aria-label={description} aria-pressed={pressed} title={description}
        className={`${cls} active:bg-fg active:text-bg`}>
        {content}
      </button>
    )
  return (
    <div role="status" aria-label={description} title={description} className={cls}>
      {content}
    </div>
  )
}

export function appChip(pwa) {
  if (pwa.devMode || !pwa.swSupported)
    return { icon: CircleAlert, label: 'Brak offline', tone: 'warn', description: 'Praca offline niedostępna (tryb deweloperski lub przeglądarka bez obsługi).' }
  if (pwa.offlineReady)
    return { icon: CircleCheck, label: 'Gotowa', tone: 'ok', ok: true, description: 'Aplikacja zapisana w tablecie – działa bez sieci.' }
  return { icon: CircleAlert, label: 'Zapisywanie', tone: 'warn', description: 'Aplikacja zapisuje się do pracy offline – nie wyłączaj sieci.' }
}

export function storageChip(storage) {
  if (storage.status === 'persistent')
    return { icon: HardDrive, label: 'Pamięć OK', tone: 'ok', ok: true, description: 'Pamięć trwała – Android nie usunie danych aplikacji.' }
  if (storage.status === 'checking')
    return { icon: HardDrive, label: 'Pamięć…', tone: 'neutral', ok: true, description: 'Sprawdzanie trwałości pamięci.' }
  return {
    icon: TriangleAlert, label: 'Pamięć!', tone: 'warn',
    description: 'Pamięć nietrwała – dotknij, aby poprosić ponownie (najpierw zainstaluj aplikację na ekranie głównym).',
    onClick: storage.status === 'unsupported' ? undefined : storage.request,
  }
}

export default function TopBar({ theme, onToggleTheme, online, wakeLock, pwa, storage, onLock }) {
  const now = useClock()
  const night = theme === 'night'
  const app = appChip(pwa)
  const mem = storageChip(storage)

  return (
    <header className="flex items-center gap-2 border-b-2 border-line bg-bg px-2 py-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div className="mr-auto flex items-center gap-3 pl-1">
        <span className="rounded bg-accent px-2 py-1 text-lg font-black tracking-wide text-accent-fg">KDR</span>
        <span className="tabular text-3xl font-bold">{fmtTime(now)}</span>
      </div>

      <Chip
        icon={online ? Wifi : WifiOff}
        label={online ? 'Sieć' : 'Brak sieci'}
        tone={online ? 'ok' : 'warn'}
        description={online ? 'Sieć: połączenie dostępne.' : 'Brak sieci – funkcje lokalne działają.'}
      />
      {/* Wskaźniki techniczne widoczne tylko, gdy coś wymaga uwagi */}
      {!app.ok && <Chip {...app} />}
      {!mem.ok && <Chip {...mem} />}

      {wakeLock.supported ? (
        <Chip
          icon={wakeLock.wanted ? Eye : EyeOff}
          label={wakeLock.wanted ? (wakeLock.active ? 'Ekran wł.' : 'Ekran ?') : 'Ekran auto'}
          tone={wakeLock.wanted ? (wakeLock.active ? 'ok' : 'warn') : 'neutral'}
          pressed={wakeLock.wanted}
          onClick={wakeLock.toggle}
          description={
            wakeLock.wanted
              ? wakeLock.active
                ? 'Ekran zawsze włączony. Dotknij, aby wrócić do automatycznego wygaszania.'
                : 'Blokada wygaszania nieprzyznana (np. oszczędzanie baterii). Dotknij, aby wyłączyć.'
              : 'Ekran wygasza się automatycznie. Dotknij, aby zawsze był włączony.'
          }
        />
      ) : (
        <Chip icon={EyeOff} label="Ekran" tone="warn" description="Blokada wygaszania ekranu nieobsługiwana – ustaw dłuższy czas w Androidzie." />
      )}

      <Chip
        icon={Lock}
        label="Zablokuj"
        onClick={onLock}
        description="Zablokuj dotyk – chroni przed przypadkowym naciśnięciem. Odblokowanie: przytrzymaj przycisk na dole."
      />

      <Chip
        icon={night ? Sun : Moon}
        label={night ? 'Dzień' : 'Noc'}
        onClick={onToggleTheme}
        description={night ? 'Przełącz na tryb dzienny' : 'Przełącz na tryb nocny'}
      />
    </header>
  )
}
