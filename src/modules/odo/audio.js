// Dźwięk alarmu bez plików (Web Audio) – działa offline.
// Android pozwala włączyć dźwięk dopiero po geście użytkownika. Gestem jest ODERWANIE palca
// (pointerup / touchend / click), a nie samo dotknięcie (pointerdown) – dlatego nasłuchujemy tych zdarzeń.
let ctx = null

export function unlockAudio() {
  try {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
    if (ctx.state !== 'running') ctx.resume().catch(() => {})
  } catch {
    /* brak Web Audio – zostaje alarm wizualny i wibracja */
  }
}

export const UNLOCK_EVENTS = ['pointerup', 'touchend', 'click', 'keydown']

export const audioReady = () => !!ctx && ctx.state === 'running'

/** Seria 3 sygnałów; volume 0–1. Próbuje wznowić dźwięk, jeśli system go uśpił. */
export async function beep(volume = 0.4) {
  if (!ctx) return
  if (ctx.state !== 'running') {
    try {
      await ctx.resume()
    } catch {
      return
    }
    if (ctx.state !== 'running') return
  }
  const t0 = ctx.currentTime + 0.02
  for (let i = 0; i < 3; i++) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.value = 1000
    const t = t0 + i * 0.28
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(volume, t + 0.01)
    gain.gain.setValueAtTime(volume, t + 0.17)
    gain.gain.linearRampToValueAtTime(0, t + 0.19)
    osc.connect(gain).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.2)
  }
}

/** Test sygnału z ustawień: dźwięk + wibracja. */
export function testAlarm() {
  unlockAudio()
  setTimeout(() => beep(1), 50)
  try {
    navigator.vibrate?.([300, 150, 300])
  } catch {
    /* ignoruj */
  }
}
