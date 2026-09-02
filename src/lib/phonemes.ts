// Approximate phonemic pronunciations for Phonics Quest's onset tiles —
// spelled the way the browser's TTS voice will actually say them close to
// the real consonant sound (e.g. "puh" for the plosive /p/), rather than
// the letter's alphabet name ("pee") that a bare `speak(onset)` would give.
// Not phonetically perfect (no IPA/SSML control over a generic TTS voice),
// but a much closer approximation than the letter name.
const PHONEME_TEXT: Record<string, string> = {
  b: 'buh', c: 'kuh', d: 'duh', f: 'fff', g: 'guh', h: 'huh',
  j: 'juh', k: 'kuh', l: 'lll', m: 'mmm', n: 'nnn', p: 'puh',
  q: 'kwuh', r: 'rrr', s: 'sss', t: 'tuh', v: 'vvv', w: 'wuh',
  x: 'ks', y: 'yuh', z: 'zzz',
  sh: 'shh', ch: 'chuh', th: 'thh', wh: 'wuh',
  bl: 'bluh', cl: 'kluh', fl: 'fluh', gl: 'gluh', pl: 'pluh', sl: 'sluh',
  br: 'bruh', cr: 'kruh', dr: 'druh', fr: 'fruh', gr: 'gruh', pr: 'pruh', tr: 'truh',
  sc: 'skuh', sk: 'skuh', sm: 'smuh', sn: 'snuh', sp: 'spuh', st: 'stuh', sw: 'swuh',
}

export function phonemeSpeechText(onset: string): string {
  return PHONEME_TEXT[onset.toLowerCase()] ?? onset
}
