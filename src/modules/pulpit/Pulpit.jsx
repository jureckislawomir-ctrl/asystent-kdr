import { Construction } from 'lucide-react'
import { MODULES } from '../../config/modules'
import { useClock, fmtTime, fmtDate } from '../../hooks/useClock'
import { appChip } from '../../components/TopBar'
import { useOdo } from '../odo/OdoContext'
import { ACTIVE_STATUSES } from '../odo/logic'
import { useStorageEstimate } from '../../hooks/useStorageEstimate'
import { useEffect, useState } from 'react'
import { dbHealth } from '../odo/db'
import { useBattery, batteryText } from '../../hooks/useBattery'

const STORAGE_LABEL = { persistent: 'trwała', 'not-persistent': 'nietrwała', unsupported: 'nieobsługiwana', checking: 'sprawdzanie' }

export default function Pulpit({ onNavigate, pwa, storage, wakeLock }) {
  const now = useClock()
  const { rotas } = useOdo()
  const usage = useStorageEstimate()
  const battery = useBattery()
  const [health, setHealth] = useState('baza: test…')
  useEffect(() => {
    dbHealth().then((h) => setHealth(h.ok ? `baza: ${h.ms} ms` : `BAZA: ${h.error}`))
  }, [])
  const inZone = rotas.filter((r) => ACTIVE_STATUSES.includes(r.status))
  // diagnostyka techniczna – małym drukiem, do sprawdzania w razie problemu
  const diag = [
    `Offline: ${appChip(pwa).label.toLowerCase()}`,
    `pamięć: ${STORAGE_LABEL[storage.status]}`,
    `blokada ekranu: ${!wakeLock.supported ? 'nieobsługiwana' : wakeLock.active ? 'aktywna' : 'nieaktywna'}`,
    usage,
    health,
    batteryText(battery),
    `ekran ${window.innerWidth}×${window.innerHeight}`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4">
      <section className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="tabular text-6xl font-black leading-none">{fmtTime(now)}</p>
          <p className="mt-1 text-xl font-bold text-muted">{fmtDate(now)}</p>
        </div>
        {/* wersja i diagnostyka techniczna – małym drukiem */}
        <div className="tabular text-sm text-muted sm:text-right">
          <p>
            Wersja {__APP_VERSION__} · zbudowano {new Date(__BUILD_DATE__).toLocaleString('pl-PL')}
          </p>
          <p>{diag}</p>
        </div>
      </section>

      {/* kafelki: tylko ikona i nazwa (+ stan ODO); moduły w przygotowaniu – przygaszone */}
      <section aria-label="Moduły" className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {MODULES.filter((m) => m.id !== 'pulpit').map(({ id, title, icon: Icon, ready }) => (
          <button
            key={id}
            type="button"
            onClick={() => onNavigate(id)}
            className={`flex min-h-28 items-center gap-4 rounded-lg border-2 bg-surface p-4 text-left active:bg-fg active:text-bg ${
              ready ? 'border-line' : 'border-dashed border-line text-muted'
            }`}
          >
            <Icon size={44} className="shrink-0" />
            <span className="flex flex-col">
              <span className="text-2xl font-black leading-tight">{title}</span>
              {id === 'odo' && inZone.length > 0 && (
                <span className="text-base font-black text-ok">W strefie: {inZone.length} rot</span>
              )}
              {!ready && (
                <span className="flex items-center gap-1 text-sm font-bold">
                  <Construction size={16} /> w przygotowaniu
                </span>
              )}
            </span>
          </button>
        ))}
      </section>

    </div>
  )
}
