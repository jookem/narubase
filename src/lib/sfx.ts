// Shared Web Audio oscillator SFX, extracted from the pattern already used in
// KidsGame.tsx so new kids features don't reinvent it a third time.

let ac: AudioContext | null = null

function ensureAudio(): boolean {
  if (!ac) {
    try { ac = new (window.AudioContext || (window as any).webkitAudioContext)() } catch { return false }
  }
  if (ac.state === 'suspended') ac.resume()
  return true
}

function beep(freq: number, t0: number, dur: number, type: OscillatorType = 'sine', vol = 0.18) {
  if (!ac) return
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = type; o.frequency.value = freq
  o.connect(g); g.connect(ac.destination)
  const t = ac.currentTime + t0
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.start(t); o.stop(t + dur + 0.03)
}

export function sfxCorrect() {
  if (!ensureAudio()) return
  ;[523.25, 659.25, 783.99].forEach((f, k) => beep(f, k * 0.1, 0.2, 'triangle', 0.18))
  beep(1046.5, 0.3, 0.25, 'triangle', 0.12)
}

export function sfxWrong() {
  if (!ensureAudio()) return
  beep(311.13, 0, 0.16, 'sine', 0.14)
  beep(246.94, 0.13, 0.22, 'sine', 0.14)
}

export function sfxTap() {
  if (!ensureAudio()) return
  beep(680, 0, 0.06, 'square', 0.06)
}

// Short rising two-note "connect" chime for Word Builder's onset-tile snap.
export function sfxBlend() {
  if (!ensureAudio()) return
  beep(440, 0, 0.1, 'triangle', 0.16)
  beep(660, 0.08, 0.16, 'triangle', 0.16)
}
