import { useEffect, useState } from 'react'

// Ile miejsca zajmują dane aplikacji (do diagnostyki na pulpicie)
export function useStorageEstimate() {
  const [text, setText] = useState('')
  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then(({ usage }) => {
        if (usage == null) return
        setText(`dane: ${usage < 1048576 ? `${Math.max(1, Math.round(usage / 1024))} KB` : `${(usage / 1048576).toFixed(1)} MB`}`)
      })
      .catch(() => {})
  }, [])
  return text
}
