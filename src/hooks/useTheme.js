import { useCallback, useEffect, useState } from 'react'

// Motyw zapisywany jako zwykły tekst ('day' | 'night'), bo czyta go też skrypt w index.html
const KEY = 'kdr.theme'

function initialTheme() {
  return document.documentElement.dataset.theme === 'night' ? 'night' : 'day'
}

export function useTheme() {
  const [theme, setTheme] = useState(initialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'night' ? '#000000' : '#ffffff')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* ignoruj */
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'night' ? 'day' : 'night')), [])
  return { theme, toggle }
}
