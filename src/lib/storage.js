// Bezpieczny dostęp do localStorage (tylko drobne ustawienia; dane akcji trafią do IndexedDB w Kroku 2)
const PREFIX = 'kdr.'

export function readSetting(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeSetting(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* brak miejsca / tryb prywatny – ustawienie nie zostanie zapamiętane */
  }
}
