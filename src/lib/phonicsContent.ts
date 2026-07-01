// Static content for Phonics Quest — 5 worlds of increasing difficulty,
// 24 units total (one unit = one level on the map). Progress against these
// units lives in the `phonics_progress` table, keyed by `PhonicsUnit.id`.
//
// Content note: most units are a classic "swap the onset before a fixed
// rime" word family (e.g. c/r/p/f + 'an' = can/ran/pan/fan). A few units
// don't fit that shape as cleanly as the PowerPoint source material first
// suggested — most digraphs can form a word-final family (e.g. 'sh' -> the
// '-ash' family: cash/dash/wash/trash) but 'wh' cannot, since it's always
// word-initial in English with no common word-final family to build one
// from. Those units use `prefixMode` instead (see WordBuilder.tsx) and, for
// Magic-E/Vowel-Team/R-Controlled units, use one consistent shared rime
// across all 4 words rather than the PPT's original mixed-rime examples, so
// every unit exercises the same, already-verified Word Builder mechanic.

export interface PhonicsWord {
  onset: string   // e.g. 'c' or 'pl' — the swappable part
  word: string    // full blended word, e.g. 'can'
  emoji: string
  jp: string      // Japanese meaning, shown before the English word
}

export interface StoryPage {
  text: string
  highlight: string[]  // substrings within `text` to color in the accent color
}

export interface PhonicsUnit {
  id: string             // stable id, matches phonics_progress.unit_id, e.g. 'w1-an'
  world: 1 | 2 | 3 | 4 | 5
  indexInWorld: number   // 0-based position for map layout
  rime: string           // e.g. 'an' — the fixed part shown statically
  silentE?: boolean      // true for Magic-E (World 3) units
  prefixMode?: boolean   // true when `rime` is a fixed PREFIX (e.g. 'wh') and
                         // `words[].onset` holds the swappable ENDING instead
                         // — needed for digraphs like 'wh' that are always
                         // word-initial in English, with no common word-final
                         // family to build an onset-swap unit from otherwise.
  onsets: string[]       // e.g. ['c','r','p','f']
  words: PhonicsWord[]   // same length/order as onsets
  mascotEmoji: string
  mascotName: string
  exampleWord: string    // spoken during Sound Intro
  storyPages: StoryPage[]
}

export interface PhonicsWorld {
  id: 1 | 2 | 3 | 4 | 5
  name: string
  nameJa: string
  color: string   // accent hex for this world's island/path on the map
}

export const PHONICS_WORLDS: PhonicsWorld[] = [
  { id: 1, name: 'Short Vowels',  nameJa: 'たんぼいん',     color: '#8BC273' },
  { id: 2, name: 'Digraphs',      nameJa: 'にじゅうじいん', color: '#7FB8E0' },
  { id: 3, name: 'Magic E',       nameJa: 'マジックE',      color: '#B08AE0' },
  { id: 4, name: 'Vowel Teams',   nameJa: 'ぼいんチーム',   color: '#4FC3B8' },
  { id: 5, name: 'R-Controlled',  nameJa: 'Rつきぼいん',    color: '#E0A052' },
]

export const PHONICS_UNITS: PhonicsUnit[] = [
  // ── World 1: Short Vowels ──────────────────────────────────────
  {
    id: 'w1-an', world: 1, indexInWorld: 0, rime: 'an',
    onsets: ['c', 'r', 'p', 'f'],
    words: [
      { onset: 'c', word: 'can', emoji: '🥫', jp: 'かん' },
      { onset: 'r', word: 'ran', emoji: '🏃', jp: 'はしった' },
      { onset: 'p', word: 'pan', emoji: '🍳', jp: 'なべ' },
      { onset: 'f', word: 'fan', emoji: '🌀', jp: 'せんぷうき' },
    ],
    mascotEmoji: '🐀', mascotName: 'Zac', exampleWord: 'can',
    storyPages: [
      { text: 'Zac ran to the pan.', highlight: ['ran', 'pan'] },
      { text: 'Zac had a can.', highlight: ['can'] },
      { text: 'The can is in the pan.', highlight: ['can', 'pan'] },
      { text: 'Zac got a fan.', highlight: ['fan'] },
      { text: 'Zac ran with the fan.', highlight: ['ran', 'fan'] },
    ],
  },
  {
    id: 'w1-at', world: 1, indexInWorld: 1, rime: 'at',
    onsets: ['h', 'r', 'c', 'b'],
    words: [
      { onset: 'h', word: 'hat', emoji: '🎩', jp: 'ぼうし' },
      { onset: 'r', word: 'rat', emoji: '🐀', jp: 'ねずみ' },
      { onset: 'c', word: 'cat', emoji: '🐱', jp: 'ねこ' },
      { onset: 'b', word: 'bat', emoji: '🏏', jp: 'バット' },
    ],
    mascotEmoji: '🐀', mascotName: 'Zac', exampleWord: 'hat',
    storyPages: [
      { text: 'Zac has a hat.', highlight: ['hat'] },
      { text: 'The cat has a hat too!', highlight: ['cat', 'hat'] },
      { text: 'A rat sat on the hat.', highlight: ['rat', 'hat'] },
      { text: 'Zac has a bat.', highlight: ['bat'] },
      { text: 'The cat and the rat like the bat.', highlight: ['cat', 'rat', 'bat'] },
    ],
  },
  {
    id: 'w1-en', world: 1, indexInWorld: 2, rime: 'en',
    onsets: ['t', 'p', 'm', 'h'],
    words: [
      { onset: 't', word: 'ten', emoji: '🔟', jp: 'じゅう' },
      { onset: 'p', word: 'pen', emoji: '🖊️', jp: 'ペン' },
      { onset: 'm', word: 'men', emoji: '🧑‍🤝‍🧑', jp: 'おとこの人たち' },
      { onset: 'h', word: 'hen', emoji: '🐔', jp: 'めんどり' },
    ],
    mascotEmoji: '🐔', mascotName: 'Peg', exampleWord: 'hen',
    storyPages: [
      { text: 'Peg is a hen.', highlight: ['hen'] },
      { text: 'Peg has a pen.', highlight: ['pen'] },
      { text: 'The pen has ten lines.', highlight: ['pen', 'ten'] },
      { text: 'Ten men see Peg.', highlight: ['ten', 'men'] },
      { text: 'Peg the hen likes her pen.', highlight: ['hen', 'pen'] },
    ],
  },
  {
    id: 'w1-et', world: 1, indexInWorld: 3, rime: 'et',
    onsets: ['n', 'p', 'w', 'j'],
    words: [
      { onset: 'n', word: 'net', emoji: '🥅', jp: 'あみ' },
      { onset: 'p', word: 'pet', emoji: '🐾', jp: 'ペット' },
      { onset: 'w', word: 'wet', emoji: '💧', jp: 'ぬれた' },
      { onset: 'j', word: 'jet', emoji: '✈️', jp: 'ジェットき' },
    ],
    mascotEmoji: '🐔', mascotName: 'Peg', exampleWord: 'pet',
    storyPages: [
      { text: 'Peg has a pet.', highlight: ['pet'] },
      { text: 'The pet is wet.', highlight: ['pet', 'wet'] },
      { text: 'Peg gets a net.', highlight: ['net'] },
      { text: 'Peg and the pet get in a jet.', highlight: ['pet', 'jet'] },
      { text: 'The jet is wet!', highlight: ['jet', 'wet'] },
    ],
  },
  {
    id: 'w1-ig', world: 1, indexInWorld: 4, rime: 'ig',
    onsets: ['p', 'd', 'w', 'b'],
    words: [
      { onset: 'p', word: 'pig', emoji: '🐷', jp: 'ぶた' },
      { onset: 'd', word: 'dig', emoji: '⛏️', jp: 'ほる' },
      { onset: 'w', word: 'wig', emoji: '👱', jp: 'かつら' },
      { onset: 'b', word: 'big', emoji: '🐘', jp: 'おおきい' },
    ],
    mascotEmoji: '🤖', mascotName: 'Tin', exampleWord: 'pig',
    storyPages: [
      { text: 'Tin sees a pig.', highlight: ['pig'] },
      { text: 'The pig can dig.', highlight: ['pig', 'dig'] },
      { text: 'Tin has a wig.', highlight: ['wig'] },
      { text: 'The wig is big!', highlight: ['wig', 'big'] },
      { text: 'Tin and the pig dig a big hole.', highlight: ['dig', 'big'] },
    ],
  },
  {
    id: 'w1-ip', world: 1, indexInWorld: 5, rime: 'ip',
    onsets: ['d', 'r', 's', 'z'],
    words: [
      { onset: 'd', word: 'dip', emoji: '🥣', jp: 'つける' },
      { onset: 'r', word: 'rip', emoji: '✂️', jp: 'やぶる' },
      { onset: 's', word: 'sip', emoji: '🥤', jp: 'すする' },
      { onset: 'z', word: 'zip', emoji: '🤐', jp: 'ジッパー' },
    ],
    mascotEmoji: '🤖', mascotName: 'Tin', exampleWord: 'zip',
    storyPages: [
      { text: 'Tin can sip.', highlight: ['sip'] },
      { text: 'Tin can dip too.', highlight: ['dip'] },
      { text: 'Do not rip it!', highlight: ['rip'] },
      { text: 'Tin has a zip.', highlight: ['zip'] },
      { text: 'Tin can zip, dip, and sip.', highlight: ['zip', 'dip', 'sip'] },
    ],
  },
  {
    id: 'w1-ot', world: 1, indexInWorld: 6, rime: 'ot',
    onsets: ['h', 'c', 'p', 'd'],
    words: [
      { onset: 'h', word: 'hot', emoji: '🔥', jp: 'あつい' },
      { onset: 'c', word: 'cot', emoji: '🛏️', jp: 'ベビーベッド' },
      { onset: 'p', word: 'pot', emoji: '🍲', jp: 'なべ' },
      { onset: 'd', word: 'dot', emoji: '🔴', jp: 'てん' },
    ],
    mascotEmoji: '🐕', mascotName: 'Dot', exampleWord: 'pot',
    storyPages: [
      { text: 'Dot sees a pot.', highlight: ['pot'] },
      { text: 'The pot is hot!', highlight: ['pot', 'hot'] },
      { text: 'Dot has a cot.', highlight: ['cot'] },
      { text: 'A dot is on the cot.', highlight: ['dot', 'cot'] },
      { text: 'Dot naps on the hot cot.', highlight: ['hot', 'cot'] },
    ],
  },
  {
    id: 'w1-og', world: 1, indexInWorld: 7, rime: 'og',
    onsets: ['l', 'd', 'fr'],
    words: [
      { onset: 'l', word: 'log', emoji: '🪵', jp: 'まるた' },
      { onset: 'd', word: 'dog', emoji: '🐶', jp: 'いぬ' },
      { onset: 'fr', word: 'frog', emoji: '🐸', jp: 'かえる' },
    ],
    mascotEmoji: '🐸', mascotName: 'Fog', exampleWord: 'frog',
    storyPages: [
      { text: 'Fog is a little frog.', highlight: ['frog'] },
      { text: 'Fog sees a dog.', highlight: ['dog'] },
      { text: 'The dog sits on a log.', highlight: ['dog', 'log'] },
      { text: 'A frog can sit on a log too.', highlight: ['frog', 'log'] },
      { text: 'Fog and the dog like the log.', highlight: ['dog', 'log'] },
    ],
  },
  {
    id: 'w1-ug', world: 1, indexInWorld: 8, rime: 'ug',
    onsets: ['h', 'r', 'b', 'm'],
    words: [
      { onset: 'h', word: 'hug', emoji: '🤗', jp: 'だきしめる' },
      { onset: 'r', word: 'rug', emoji: '🟫', jp: 'じゅうたん' },
      { onset: 'b', word: 'bug', emoji: '🐛', jp: 'むし' },
      { onset: 'm', word: 'mug', emoji: '☕', jp: 'マグカップ' },
    ],
    mascotEmoji: '🦆', mascotName: 'Gus', exampleWord: 'hug',
    storyPages: [
      { text: 'Gus has a hug.', highlight: ['hug'] },
      { text: 'Gus sees a bug.', highlight: ['bug'] },
      { text: 'The bug is on the rug.', highlight: ['bug', 'rug'] },
      { text: 'Gus has a mug.', highlight: ['mug'] },
      { text: 'Gus and the bug hug on the rug.', highlight: ['hug', 'bug', 'rug'] },
    ],
  },

  // ── World 2: Digraphs ──────────────────────────────────────────
  {
    id: 'w2-sh', world: 2, indexInWorld: 0, rime: 'ash',
    onsets: ['c', 'd', 'w', 'tr'],
    words: [
      { onset: 'c', word: 'cash', emoji: '💵', jp: 'げんきん' },
      { onset: 'd', word: 'dash', emoji: '🏃', jp: 'はしる' },
      { onset: 'w', word: 'wash', emoji: '🧼', jp: 'あらう' },
      { onset: 'tr', word: 'trash', emoji: '🗑️', jp: 'ごみ' },
    ],
    mascotEmoji: '🦊', mascotName: 'Mox', exampleWord: 'wash',
    storyPages: [
      { text: 'Mox needs cash.', highlight: ['cash'] },
      { text: 'Mox will dash to get it.', highlight: ['dash'] },
      { text: 'Mox must wash up.', highlight: ['wash'] },
      { text: 'Put the trash away.', highlight: ['trash'] },
      { text: 'Mox has cash, and no trash!', highlight: ['cash', 'trash'] },
    ],
  },
  {
    id: 'w2-ch', world: 2, indexInWorld: 1, rime: 'atch',
    onsets: ['c', 'm', 'w', 'p'],
    words: [
      { onset: 'c', word: 'catch', emoji: '🧤', jp: 'キャッチする' },
      { onset: 'm', word: 'match', emoji: '🔥', jp: 'マッチ' },
      { onset: 'w', word: 'watch', emoji: '⌚', jp: 'とけい' },
      { onset: 'p', word: 'patch', emoji: '🩹', jp: 'パッチ' },
    ],
    mascotEmoji: '🚂', mascotName: 'Charlie', exampleWord: 'catch',
    storyPages: [
      { text: 'Charlie can catch the ball.', highlight: ['catch'] },
      { text: 'Look, a match!', highlight: ['match'] },
      { text: 'Charlie has a watch.', highlight: ['watch'] },
      { text: 'Put a patch on it.', highlight: ['patch'] },
      { text: 'Charlie can catch, watch, and fix a patch.', highlight: ['catch', 'watch', 'patch'] },
    ],
  },
  {
    id: 'w2-th', world: 2, indexInWorld: 2, rime: 'ath',
    onsets: ['p', 'b', 'm'],
    words: [
      { onset: 'p', word: 'path', emoji: '🥾', jp: 'こみち' },
      { onset: 'b', word: 'bath', emoji: '🛁', jp: 'おふろ' },
      { onset: 'm', word: 'math', emoji: '➕', jp: 'さんすう' },
    ],
    mascotEmoji: '🦷', mascotName: 'Theo', exampleWord: 'bath',
    storyPages: [
      { text: 'Theo walks on the path.', highlight: ['path'] },
      { text: 'Theo takes a bath.', highlight: ['bath'] },
      { text: 'Theo likes math.', highlight: ['math'] },
      { text: 'The path leads to the bath.', highlight: ['path', 'bath'] },
      { text: 'Theo does math after the bath.', highlight: ['math', 'bath'] },
    ],
  },
  {
    id: 'w2-wh', world: 2, indexInWorld: 3, rime: 'wh', prefixMode: true,
    onsets: ['y', 'at', 'en', 'ich'],
    words: [
      { onset: 'y', word: 'why', emoji: '❓', jp: 'なぜ' },
      { onset: 'at', word: 'what', emoji: '❔', jp: 'なに' },
      { onset: 'en', word: 'when', emoji: '⏰', jp: 'いつ' },
      { onset: 'ich', word: 'which', emoji: '🤔', jp: 'どれ' },
    ],
    mascotEmoji: '🐋', mascotName: 'Willa', exampleWord: 'what',
    storyPages: [
      { text: "Willa asks, ‘Why is it big?’", highlight: ['Why'] },
      { text: "Willa asks, ‘What is it?’", highlight: ['What'] },
      { text: "Willa asks, ‘When can we go?’", highlight: ['When'] },
      { text: "Willa asks, ‘Which one is mine?’", highlight: ['Which'] },
      { text: 'Willa the whale asks why, what, when, and which!', highlight: ['why', 'what', 'when', 'which'] },
    ],
  },

  // ── World 3: Magic E ───────────────────────────────────────────
  {
    id: 'w3-a_e', world: 3, indexInWorld: 0, rime: 'ane', silentE: true,
    onsets: ['c', 'pl', 'l', 'm'],
    words: [
      { onset: 'c', word: 'cane', emoji: '🦯', jp: 'つえ' },
      { onset: 'pl', word: 'plane', emoji: '✈️', jp: 'ひこうき' },
      { onset: 'l', word: 'lane', emoji: '🛣️', jp: 'どうろ' },
      { onset: 'm', word: 'mane', emoji: '🦁', jp: 'たてがみ' },
    ],
    mascotEmoji: '🏄', mascotName: 'Jake', exampleWord: 'plane',
    storyPages: [
      { text: 'Jake has a cane.', highlight: ['cane'] },
      { text: 'Jake flies a plane.', highlight: ['plane'] },
      { text: 'The plane flies down the lane.', highlight: ['plane', 'lane'] },
      { text: 'The lion shakes its mane.', highlight: ['mane'] },
      { text: 'Jake, the plane, and the lane are ready!', highlight: ['plane', 'lane'] },
    ],
  },
  {
    id: 'w3-i_e', world: 3, indexInWorld: 1, rime: 'ide', silentE: true,
    onsets: ['h', 'r', 't', 'w'],
    words: [
      { onset: 'h', word: 'hide', emoji: '🙈', jp: 'かくれる' },
      { onset: 'r', word: 'ride', emoji: '🚴', jp: 'のる' },
      { onset: 't', word: 'tide', emoji: '🌊', jp: 'しお' },
      { onset: 'w', word: 'wide', emoji: '↔️', jp: 'ひろい' },
    ],
    mascotEmoji: '🦔', mascotName: 'Spike', exampleWord: 'ride',
    storyPages: [
      { text: 'Spike will hide.', highlight: ['hide'] },
      { text: 'Spike likes to ride.', highlight: ['ride'] },
      { text: 'Spike waits for the tide.', highlight: ['tide'] },
      { text: 'The road is wide.', highlight: ['wide'] },
      { text: 'Spike can hide, ride, and see the wide tide.', highlight: ['hide', 'ride', 'wide', 'tide'] },
    ],
  },
  {
    id: 'w3-o_e', world: 3, indexInWorld: 2, rime: 'one', silentE: true,
    onsets: ['b', 'c', 't', 'st'],
    words: [
      { onset: 'b', word: 'bone', emoji: '🦴', jp: 'ほね' },
      { onset: 'c', word: 'cone', emoji: '🍦', jp: 'コーン' },
      { onset: 't', word: 'tone', emoji: '🎵', jp: 'おと' },
      { onset: 'st', word: 'stone', emoji: '🪨', jp: 'いし' },
    ],
    mascotEmoji: '🦫', mascotName: 'Milo', exampleWord: 'bone',
    storyPages: [
      { text: 'Milo has a bone.', highlight: ['bone'] },
      { text: 'Milo eats a cone.', highlight: ['cone'] },
      { text: 'Milo sings a tone.', highlight: ['tone'] },
      { text: 'Milo sits on a stone.', highlight: ['stone'] },
      { text: 'Milo has a bone, a cone, and a stone!', highlight: ['bone', 'cone', 'stone'] },
    ],
  },
  {
    id: 'w3-u_e', world: 3, indexInWorld: 3, rime: 'une', silentE: true,
    onsets: ['j', 't', 'pr', 'd'],
    words: [
      { onset: 'j', word: 'June', emoji: '📅', jp: '6月' },
      { onset: 't', word: 'tune', emoji: '🎵', jp: 'メロディー' },
      { onset: 'pr', word: 'prune', emoji: '🍇', jp: 'ほしすもも' },
      { onset: 'd', word: 'dune', emoji: '🏜️', jp: 'さきゅう' },
    ],
    mascotEmoji: '🚙', mascotName: 'Duke', exampleWord: 'dune',
    storyPages: [
      { text: 'Duke drives in June.', highlight: ['June'] },
      { text: 'Duke plays a tune.', highlight: ['tune'] },
      { text: 'Duke eats a prune.', highlight: ['prune'] },
      { text: 'Duke drives over the dune.', highlight: ['dune'] },
      { text: 'In June, Duke plays a tune on the dune.', highlight: ['June', 'tune', 'dune'] },
    ],
  },

  // ── World 4: Vowel Teams ───────────────────────────────────────
  {
    id: 'w4-ee', world: 4, indexInWorld: 0, rime: 'eet',
    onsets: ['f', 'm', 'sw', 'gr'],
    words: [
      { onset: 'f', word: 'feet', emoji: '🦶', jp: 'あし' },
      { onset: 'm', word: 'meet', emoji: '🤝', jp: 'あう' },
      { onset: 'sw', word: 'sweet', emoji: '🍬', jp: 'あまい' },
      { onset: 'gr', word: 'greet', emoji: '👋', jp: 'あいさつする' },
    ],
    mascotEmoji: '🐑', mascotName: 'Pete', exampleWord: 'feet',
    storyPages: [
      { text: 'Pete has big feet.', highlight: ['feet'] },
      { text: 'Pete will meet a friend.', highlight: ['meet'] },
      { text: 'The candy is sweet.', highlight: ['sweet'] },
      { text: 'Pete waves to greet them.', highlight: ['greet'] },
      { text: "Pete's feet meet a sweet friend to greet.", highlight: ['feet', 'meet', 'sweet', 'greet'] },
    ],
  },
  {
    id: 'w4-ai', world: 4, indexInWorld: 1, rime: 'ail',
    onsets: ['m', 's', 'n', 'j'],
    words: [
      { onset: 'm', word: 'mail', emoji: '📬', jp: 'ゆうびん' },
      { onset: 's', word: 'sail', emoji: '⛵', jp: 'ほ' },
      { onset: 'n', word: 'nail', emoji: '💅', jp: 'つめ' },
      { onset: 'j', word: 'jail', emoji: '🔒', jp: 'ろうや' },
    ],
    mascotEmoji: '🐌', mascotName: 'Gail', exampleWord: 'sail',
    storyPages: [
      { text: 'Gail gets the mail.', highlight: ['mail'] },
      { text: 'Gail sets sail.', highlight: ['sail'] },
      { text: 'Gail paints a nail.', highlight: ['nail'] },
      { text: 'Gail is not in jail!', highlight: ['jail'] },
      { text: 'Gail the snail gets mail, sets sail, and paints a nail.', highlight: ['mail', 'sail', 'nail'] },
    ],
  },
  {
    id: 'w4-ea', world: 4, indexInWorld: 2, rime: 'eat',
    onsets: ['s', 'm', 'h', 'b'],
    words: [
      { onset: 's', word: 'seat', emoji: '💺', jp: 'せき' },
      { onset: 'm', word: 'meat', emoji: '🍖', jp: 'にく' },
      { onset: 'h', word: 'heat', emoji: '🔥', jp: 'ねつ' },
      { onset: 'b', word: 'beat', emoji: '🥁', jp: 'ビート' },
    ],
    mascotEmoji: '🦭', mascotName: 'Rea', exampleWord: 'seat',
    storyPages: [
      { text: 'Rea finds a seat.', highlight: ['seat'] },
      { text: 'Rea eats meat.', highlight: ['meat'] },
      { text: 'Rea feels the heat.', highlight: ['heat'] },
      { text: 'Rea taps to the beat.', highlight: ['beat'] },
      { text: 'Rea sits in her seat and eats meat to the beat.', highlight: ['seat', 'meat', 'beat'] },
    ],
  },
  {
    id: 'w4-oa', world: 4, indexInWorld: 3, rime: 'oat',
    onsets: ['b', 'c', 'g', 'fl'],
    words: [
      { onset: 'b', word: 'boat', emoji: '⛵', jp: 'ボート' },
      { onset: 'c', word: 'coat', emoji: '🧥', jp: 'コート' },
      { onset: 'g', word: 'goat', emoji: '🐐', jp: 'やぎ' },
      { onset: 'fl', word: 'float', emoji: '🛟', jp: 'うく' },
    ],
    mascotEmoji: '⛵', mascotName: 'Joe', exampleWord: 'boat',
    storyPages: [
      { text: 'Joe has a boat.', highlight: ['boat'] },
      { text: 'Joe wears a coat.', highlight: ['coat'] },
      { text: 'Joe sees a goat.', highlight: ['goat'] },
      { text: 'The goat can float!', highlight: ['goat', 'float'] },
      { text: 'Joe and the goat float on the boat.', highlight: ['goat', 'float', 'boat'] },
    ],
  },

  // ── World 5: R-Controlled ──────────────────────────────────────
  {
    id: 'w5-ar', world: 5, indexInWorld: 0, rime: 'ark',
    onsets: ['p', 'd', 'sh', 'sp'],
    words: [
      { onset: 'p', word: 'park', emoji: '🏞️', jp: 'こうえん' },
      { onset: 'd', word: 'dark', emoji: '🌑', jp: 'くらい' },
      { onset: 'sh', word: 'shark', emoji: '🦈', jp: 'さめ' },
      { onset: 'sp', word: 'spark', emoji: '✨', jp: 'ひばな' },
    ],
    mascotEmoji: '🦈', mascotName: 'Marty', exampleWord: 'shark',
    storyPages: [
      { text: 'Marty swims in the dark.', highlight: ['dark'] },
      { text: 'Marty sees a spark.', highlight: ['spark'] },
      { text: 'Marty is a shark.', highlight: ['shark'] },
      { text: 'Marty swims to the park.', highlight: ['park'] },
      { text: 'Marty the shark swims in the dark park.', highlight: ['shark', 'dark', 'park'] },
    ],
  },
  {
    id: 'w5-or', world: 5, indexInWorld: 1, rime: 'orn',
    onsets: ['c', 'h', 'th', 'b'],
    words: [
      { onset: 'c', word: 'corn', emoji: '🌽', jp: 'とうもろこし' },
      { onset: 'h', word: 'horn', emoji: '📯', jp: 'つの' },
      { onset: 'th', word: 'thorn', emoji: '🌹', jp: 'とげ' },
      { onset: 'b', word: 'born', emoji: '👶', jp: 'うまれた' },
    ],
    mascotEmoji: '🦄', mascotName: 'Norm', exampleWord: 'horn',
    storyPages: [
      { text: 'Norm eats corn.', highlight: ['corn'] },
      { text: 'Norm has a horn.', highlight: ['horn'] },
      { text: 'Norm sees a thorn.', highlight: ['thorn'] },
      { text: 'Norm was born here.', highlight: ['born'] },
      { text: 'Norm the unicorn has a horn and eats corn.', highlight: ['horn', 'corn'] },
    ],
  },
  {
    id: 'w5-ir', world: 5, indexInWorld: 2, rime: 'irt',
    onsets: ['sh', 'sk', 'd'],
    words: [
      { onset: 'sh', word: 'shirt', emoji: '👕', jp: 'シャツ' },
      { onset: 'sk', word: 'skirt', emoji: '👗', jp: 'スカート' },
      { onset: 'd', word: 'dirt', emoji: '🟤', jp: 'どろ' },
    ],
    mascotEmoji: '🏄‍♀️', mascotName: 'Fern', exampleWord: 'shirt',
    storyPages: [
      { text: 'Fern wears a shirt.', highlight: ['shirt'] },
      { text: 'Fern wears a skirt.', highlight: ['skirt'] },
      { text: 'Fern gets dirt on it.', highlight: ['dirt'] },
      { text: 'Fern washes off the dirt.', highlight: ['dirt'] },
      { text: "Fern's shirt and skirt have dirt!", highlight: ['shirt', 'skirt', 'dirt'] },
    ],
  },
]
