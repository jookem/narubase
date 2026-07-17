// Curated keyword -> emoji dictionary powering the Story Lab's "+ Add
// object" search (no npm emoji-search package exists in this project — see
// AddObjectField in StoryLab.tsx). Covers this app's phonics target words
// (see src/lib/phonicsContent.ts) plus common kid-story vocabulary
// (animals, food, weather, vehicles, household/school items).
interface EmojiEntry {
  emoji: string
  keywords: string[]
}

const EMOJI_LIBRARY: EmojiEntry[] = [
  // Phonics target words (w1-w5 families)
  { emoji: '🦇', keywords: ['bat', 'animal'] },
  { emoji: '🛁', keywords: ['bath', 'tub'] },
  { emoji: '🛶', keywords: ['boat', 'canoe'] },
  { emoji: '⛵', keywords: ['sail', 'sailboat', 'boat'] },
  { emoji: '🦴', keywords: ['bone', 'dog'] },
  { emoji: '👶', keywords: ['born', 'baby'] },
  { emoji: '🐛', keywords: ['bug', 'caterpillar', 'insect'] },
  { emoji: '🥫', keywords: ['can', 'tin'] },
  { emoji: '🦯', keywords: ['cane', 'stick'] },
  { emoji: '💵', keywords: ['cash', 'money'] },
  { emoji: '🐱', keywords: ['cat', 'kitten', 'kitty'] },
  { emoji: '🧥', keywords: ['coat', 'jacket'] },
  { emoji: '🍦', keywords: ['cone', 'ice cream'] },
  { emoji: '🚧', keywords: ['cone', 'traffic cone'] },
  { emoji: '🌽', keywords: ['corn'] },
  { emoji: '🛏️', keywords: ['cot', 'bed', 'crib'] },
  { emoji: '🌑', keywords: ['dark', 'night', 'moon'] },
  { emoji: '💨', keywords: ['dash', 'wind', 'fast'] },
  { emoji: '⛏️', keywords: ['dig', 'pickaxe'] },
  { emoji: '🥣', keywords: ['dip', 'bowl'] },
  { emoji: '🐶', keywords: ['dog', 'puppy'] },
  { emoji: '🔴', keywords: ['dot', 'circle'] },
  { emoji: '🏜️', keywords: ['dune', 'desert', 'sand'] },
  { emoji: '🪭', keywords: ['fan'] },
  { emoji: '🦶', keywords: ['feet', 'foot'] },
  { emoji: '🛟', keywords: ['float', 'life ring'] },
  { emoji: '🐸', keywords: ['frog'] },
  { emoji: '🐐', keywords: ['goat'] },
  { emoji: '👋', keywords: ['greet', 'wave', 'hello'] },
  { emoji: '🎩', keywords: ['hat'] },
  { emoji: '🔥', keywords: ['heat', 'hot', 'fire'] },
  { emoji: '🐔', keywords: ['hen', 'chicken'] },
  { emoji: '🙈', keywords: ['hide', 'peekaboo'] },
  { emoji: '📯', keywords: ['horn'] },
  { emoji: '🤗', keywords: ['hug'] },
  { emoji: '✈️', keywords: ['jet', 'plane', 'airplane'] },
  { emoji: '🛣️', keywords: ['lane', 'road'] },
  { emoji: '🪵', keywords: ['log', 'wood'] },
  { emoji: '📬', keywords: ['mail', 'mailbox', 'letter'] },
  { emoji: '🦁', keywords: ['mane', 'lion'] },
  { emoji: '🧮', keywords: ['math', 'abacus'] },
  { emoji: '🥩', keywords: ['meat', 'steak'] },
  { emoji: '🤝', keywords: ['meet', 'handshake'] },
  { emoji: '👨', keywords: ['men', 'man'] },
  { emoji: '☕', keywords: ['mug', 'cup', 'coffee'] },
  { emoji: '💅', keywords: ['nail', 'fingernail'] },
  { emoji: '🥅', keywords: ['net', 'goal'] },
  { emoji: '🍳', keywords: ['pan', 'frying pan'] },
  { emoji: '🏞️', keywords: ['park'] },
  { emoji: '🩹', keywords: ['patch', 'bandage'] },
  { emoji: '🛤️', keywords: ['path', 'railway', 'trail'] },
  { emoji: '🖊️', keywords: ['pen'] },
  { emoji: '🐾', keywords: ['pet', 'paw'] },
  { emoji: '🐷', keywords: ['pig'] },
  { emoji: '🍲', keywords: ['pot', 'stew'] },
  { emoji: '🏃', keywords: ['ran', 'run', 'running'] },
  { emoji: '🐀', keywords: ['rat', 'mouse'] },
  { emoji: '🎢', keywords: ['ride', 'roller coaster'] },
  { emoji: '🪑', keywords: ['seat', 'chair'] },
  { emoji: '🦈', keywords: ['shark'] },
  { emoji: '👕', keywords: ['shirt'] },
  { emoji: '🥤', keywords: ['sip', 'drink', 'straw'] },
  { emoji: '👗', keywords: ['skirt', 'dress'] },
  { emoji: '✨', keywords: ['spark', 'sparkle'] },
  { emoji: '🪨', keywords: ['stone', 'rock'] },
  { emoji: '🍬', keywords: ['sweet', 'candy'] },
  { emoji: '🔟', keywords: ['ten'] },
  { emoji: '🌹', keywords: ['thorn', 'rose'] },
  { emoji: '🌊', keywords: ['tide', 'wave', 'ocean'] },
  { emoji: '🎵', keywords: ['tone', 'tune', 'music', 'note'] },
  { emoji: '🗑️', keywords: ['trash', 'garbage', 'bin'] },
  { emoji: '🧼', keywords: ['wash', 'soap'] },
  { emoji: '⌚', keywords: ['watch', 'clock'] },
  { emoji: '💧', keywords: ['wet', 'water', 'drop'] },
  { emoji: '💇', keywords: ['wig', 'hair'] },
  { emoji: '🤐', keywords: ['zip', 'zipper'] },

  // Common animals
  { emoji: '🐻', keywords: ['bear'] },
  { emoji: '🐦', keywords: ['bird'] },
  { emoji: '🐝', keywords: ['bee'] },
  { emoji: '🦋', keywords: ['butterfly'] },
  { emoji: '🐄', keywords: ['cow'] },
  { emoji: '🦆', keywords: ['duck'] },
  { emoji: '🐘', keywords: ['elephant'] },
  { emoji: '🐟', keywords: ['fish'] },
  { emoji: '🦊', keywords: ['fox'] },
  { emoji: '🐴', keywords: ['horse'] },
  { emoji: '🦁', keywords: ['lion'] },
  { emoji: '🐵', keywords: ['monkey'] },
  { emoji: '🐭', keywords: ['mouse'] },
  { emoji: '🦉', keywords: ['owl'] },
  { emoji: '🐧', keywords: ['penguin'] },
  { emoji: '🐰', keywords: ['rabbit', 'bunny'] },
  { emoji: '🐑', keywords: ['sheep'] },
  { emoji: '🐍', keywords: ['snake'] },
  { emoji: '🕷️', keywords: ['spider'] },
  { emoji: '🐯', keywords: ['tiger'] },
  { emoji: '🐢', keywords: ['turtle'] },
  { emoji: '🐋', keywords: ['whale'] },
  { emoji: '🐺', keywords: ['wolf'] },
  { emoji: '🦌', keywords: ['deer'] },
  { emoji: '🐿️', keywords: ['squirrel'] },
  { emoji: '🐴', keywords: ['pony'] },
  { emoji: '🦄', keywords: ['unicorn'] },

  // Food
  { emoji: '🍎', keywords: ['apple'] },
  { emoji: '🍌', keywords: ['banana'] },
  { emoji: '🍞', keywords: ['bread'] },
  { emoji: '🎂', keywords: ['cake', 'birthday'] },
  { emoji: '🧀', keywords: ['cheese'] },
  { emoji: '🍪', keywords: ['cookie'] },
  { emoji: '🥚', keywords: ['egg'] },
  { emoji: '🍇', keywords: ['grape'] },
  { emoji: '🍦', keywords: ['ice cream'] },
  { emoji: '🥛', keywords: ['milk'] },
  { emoji: '🍊', keywords: ['orange'] },
  { emoji: '🍕', keywords: ['pizza'] },
  { emoji: '🍚', keywords: ['rice'] },
  { emoji: '🥪', keywords: ['sandwich'] },
  { emoji: '🍓', keywords: ['strawberry'] },
  { emoji: '🍉', keywords: ['watermelon'] },
  { emoji: '🍭', keywords: ['lollipop', 'candy'] },
  { emoji: '🍯', keywords: ['honey'] },

  // Nature / weather
  { emoji: '☁️', keywords: ['cloud'] },
  { emoji: '🌸', keywords: ['flower', 'blossom'] },
  { emoji: '🌱', keywords: ['grass', 'plant', 'sprout'] },
  { emoji: '🌙', keywords: ['moon'] },
  { emoji: '⛰️', keywords: ['mountain'] },
  { emoji: '🌧️', keywords: ['rain'] },
  { emoji: '🌈', keywords: ['rainbow'] },
  { emoji: '❄️', keywords: ['snow', 'snowflake'] },
  { emoji: '⭐', keywords: ['star'] },
  { emoji: '☀️', keywords: ['sun', 'sunny'] },
  { emoji: '🌳', keywords: ['tree'] },
  { emoji: '☂️', keywords: ['umbrella'] },
  { emoji: '🌍', keywords: ['world', 'earth', 'globe'] },
  { emoji: '🔥', keywords: ['fire', 'flame'] },
  { emoji: '🧊', keywords: ['ice', 'ice cube'] },

  // Transportation
  { emoji: '🚲', keywords: ['bicycle', 'bike'] },
  { emoji: '🚌', keywords: ['bus'] },
  { emoji: '🚗', keywords: ['car'] },
  { emoji: '🚁', keywords: ['helicopter'] },
  { emoji: '🚀', keywords: ['rocket'] },
  { emoji: '🚢', keywords: ['ship'] },
  { emoji: '🚂', keywords: ['train'] },
  { emoji: '🚚', keywords: ['truck'] },

  // Household / school
  { emoji: '🎒', keywords: ['backpack', 'bag'] },
  { emoji: '⚽', keywords: ['ball'] },
  { emoji: '🎈', keywords: ['balloon'] },
  { emoji: '📖', keywords: ['book'] },
  { emoji: '🪑', keywords: ['chair'] },
  { emoji: '🕐', keywords: ['clock', 'time'] },
  { emoji: '🚪', keywords: ['door'] },
  { emoji: '🏠', keywords: ['house', 'home'] },
  { emoji: '🔑', keywords: ['key'] },
  { emoji: '💡', keywords: ['lamp', 'light', 'bulb'] },
  { emoji: '✏️', keywords: ['pencil'] },
  { emoji: '📱', keywords: ['phone'] },
  { emoji: '✂️', keywords: ['scissors'] },
  { emoji: '🪟', keywords: ['window'] },
  { emoji: '🧸', keywords: ['toy', 'teddy bear'] },
  { emoji: '🎁', keywords: ['gift', 'present'] },
  { emoji: '🪁', keywords: ['kite'] },
  { emoji: '🤖', keywords: ['robot'] },
  { emoji: '👻', keywords: ['ghost'] },
  { emoji: '🐉', keywords: ['dragon'] },
  { emoji: '🦕', keywords: ['dinosaur'] },
  { emoji: '🏰', keywords: ['castle'] },
  { emoji: '🌉', keywords: ['bridge'] },
  { emoji: '🏝️', keywords: ['island'] },
  { emoji: '💎', keywords: ['gem', 'diamond', 'jewel'] },
  { emoji: '👑', keywords: ['crown', 'king', 'queen'] },

  // Body / emotions
  { emoji: '👀', keywords: ['eye', 'eyes'] },
  { emoji: '👂', keywords: ['ear'] },
  { emoji: '✋', keywords: ['hand'] },
  { emoji: '❤️', keywords: ['heart', 'love'] },
  { emoji: '😀', keywords: ['smile', 'happy', 'face'] },
  { emoji: '😢', keywords: ['sad', 'cry', 'tear'] },
  { emoji: '😴', keywords: ['sleep', 'tired'] },
]

export interface EmojiSuggestion {
  emoji: string
  label: string
}

// Extended_Pictographic covers essentially all emoji, including ones
// combined with variation selectors/ZWJ — good enough to tell "the user
// pasted an actual emoji" apart from "the user is typing a word".
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u

export function looksLikeEmoji(text: string): boolean {
  return EMOJI_PATTERN.test(text)
}

// Keyword-prefix matches rank above mid-word matches (typing "dog" should
// surface 🐶 before anything that merely contains "dog" somewhere), each
// emoji appears at most once even if several keywords match.
export function searchEmoji(query: string, limit = 10): EmojiSuggestion[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts: EmojiSuggestion[] = []
  const includes: EmojiSuggestion[] = []
  const seen = new Set<string>()
  for (const entry of EMOJI_LIBRARY) {
    if (seen.has(entry.emoji)) continue
    if (entry.keywords.some(k => k.startsWith(q))) {
      starts.push({ emoji: entry.emoji, label: entry.keywords[0] })
      seen.add(entry.emoji)
    } else if (entry.keywords.some(k => k.includes(q))) {
      includes.push({ emoji: entry.emoji, label: entry.keywords[0] })
      seen.add(entry.emoji)
    }
  }
  return [...starts, ...includes].slice(0, limit)
}
