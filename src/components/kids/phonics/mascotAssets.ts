// Maps a unit's mascotName (phonicsContent.ts) to its SVG art file basename
// in public/mascots/svg/. Every mascot's file matches its story name except
// the frog: its art was drawn as "Fred" before the story settled on "Fog".
const FILE_ALIASES: Record<string, string> = { Fog: 'Fred' }

export function mascotSvgUrl(mascotName: string, happy = false): string {
  const file = FILE_ALIASES[mascotName] ?? mascotName
  return `/mascots/svg/${file}${happy ? '_happy' : ''}.svg`
}
