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

// Like beep(), but sweeps frequency from f0 to f1 instead of holding steady —
// needed for a "boing" cue, which reads as a pitch bend, not a fixed note.
function sweep(f0: number, f1: number, t0: number, dur: number, vol = 0.16) {
  if (!ac) return
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = 'sine'
  o.connect(g); g.connect(ac.destination)
  const t = ac.currentTime + t0
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(Math.max(f1, 1), t + dur)
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

// Springy downward pitch bend — cue for Phonics Quest's story mascot
// setting off along its motion path. Original synthesis, not extracted
// from the source lesson deck's bundled stock "boing" clip.
export function sfxMotionStart() {
  if (!ensureAudio()) return
  sweep(320, 90, 0, 0.26, 0.14)
}

// Short bright blip — cue for the mascot arriving at its destination.
export function sfxArrive() {
  if (!ensureAudio()) return
  beep(900, 0, 0.09, 'triangle', 0.18)
}

// Referee-style whistle for Word Catch's "goal" moment — a held high tone
// with a fast trill (rapid pitch wobble), which is what reads as "whistle"
// rather than a plain beep.
export function sfxWhistle() {
  if (!ensureAudio() || !ac) return
  const o = ac.createOscillator(), g = ac.createGain()
  o.type = 'square'
  o.connect(g); g.connect(ac.destination)
  const t = ac.currentTime
  const dur = 0.45
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.16, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  for (let i = 0; i < 12; i++) {
    o.frequency.setValueAtTime(i % 2 === 0 ? 2950 : 2800, t + i * 0.035)
  }
  o.start(t); o.stop(t + dur + 0.03)
}

// Crowd cheer for a combo streak milestone — filtered noise burst (the
// standard trick for a "crowd" texture, since no small set of oscillators
// reads as a crowd) with a couple of bright pitch-bent "whoop" blips
// layered on top for character.
export function sfxCheer() {
  if (!ensureAudio() || !ac) return
  const dur = 1.1
  const buffer = ac.createBuffer(1, Math.floor(ac.sampleRate * dur), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const noise = ac.createBufferSource()
  noise.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1200
  filter.Q.value = 0.6
  const g = ac.createGain()
  noise.connect(filter); filter.connect(g); g.connect(ac.destination)
  const t = ac.currentTime
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.22, t + 0.15)
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.5)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  noise.start(t); noise.stop(t + dur)
  ;[0.05, 0.25].forEach((delay, k) => {
    const o = ac!.createOscillator(), og = ac!.createGain()
    o.type = 'triangle'
    o.connect(og); og.connect(ac!.destination)
    const ot = t + delay
    o.frequency.setValueAtTime(500 + k * 120, ot)
    o.frequency.exponentialRampToValueAtTime(900 + k * 120, ot + 0.2)
    og.gain.setValueAtTime(0.0001, ot)
    og.gain.exponentialRampToValueAtTime(0.12, ot + 0.05)
    og.gain.exponentialRampToValueAtTime(0.0001, ot + 0.3)
    o.start(ot); o.stop(ot + 0.35)
  })
}
