// Shared `@keyframes kg-*` used across the kids games AND StoryReader.
// KidsGame.tsx injects these for the normal game flow, but StoryReader is
// also mounted standalone by StoryLab.tsx (Materials page's "Phonics Story
// Lab" tab, outside of <KidsGame>) — without its own call to this, any
// prop/target motion path there would have no keyframe to run and would
// render at the (0,0) corner instead of animating into place.
const KEYFRAMES_CSS = [
  '@keyframes kg-pop{0%{transform:scale(.4);opacity:0}50%{transform:scale(1.15);opacity:1}100%{transform:scale(1);opacity:1}}',
  '@keyframes kg-floaty{0%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-10px) rotate(4deg)}100%{transform:translateY(0) rotate(-4deg)}}',
  '@keyframes kg-twinkle{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.25);opacity:1}}',
  '@keyframes kg-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-7px)}40%{transform:translateX(7px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}',
  '@keyframes kg-bounceIn{0%{transform:scale(.6)}60%{transform:scale(1.08)}100%{transform:scale(1)}}',
  '@keyframes kg-storyRun{0%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-6px) rotate(-6deg)}50%{transform:translateY(0) rotate(0deg)}75%{transform:translateY(-6px) rotate(6deg)}100%{transform:translateY(0) rotate(0deg)}}',
  '@keyframes kg-floaty-land{0%,50%,100%{transform:translateY(0) rotate(0deg)}25%{transform:translateY(-8px) rotate(5deg)}75%{transform:translateY(-8px) rotate(-5deg)}}',
  '@keyframes kg-fadeIn{0%{opacity:0}100%{opacity:1}}',
  '@keyframes kg-wipeIn{0%{clip-path:inset(var(--wipe-start,0 0 100% 0))}100%{clip-path:inset(0 0 0 0)}}',
  '@keyframes kg-flyIn{0%{transform:translate(var(--fly-x,0),var(--fly-y,0));opacity:0}100%{transform:translate(0,0);opacity:1}}',
  '@keyframes kg-wiggle{0%,100%{transform:rotate(0deg)}25%{transform:rotate(-3deg)}75%{transform:rotate(3deg)}}',
  '@keyframes kg-growShrink{0%,100%{transform:scale(1)}50%{transform:scale(1.2)}}',
  '@keyframes kg-spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}',
  '@keyframes kg-hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}',
  '@keyframes kg-arcMove{0%{left:var(--arc-start);transform:translateY(0)}50%{left:var(--arc-mid);transform:translateY(var(--arc-height))}100%{left:var(--arc-end);transform:translateY(0)}}',
  '@keyframes kg-motion2D{0%{left:var(--m-start-x);top:var(--m-start-y);transform:translateY(0)}50%{left:var(--m-mid-x);top:var(--m-mid-y);transform:translateY(var(--m-arc))}100%{left:var(--m-end-x);top:var(--m-end-y);transform:translateY(0)}}',
  '.kg-hub-scroll{overflow-y:auto;scrollbar-width:thin;scrollbar-color:rgba(200,170,150,0.5) transparent}',
  '.kg-hub-scroll::-webkit-scrollbar{width:8px}',
  '.kg-hub-scroll::-webkit-scrollbar-track{background:transparent}',
  '.kg-hub-scroll::-webkit-scrollbar-thumb{background:rgba(200,170,150,0.45);border-radius:4px}',
  '.kg-hub-scroll::-webkit-scrollbar-thumb:hover{background:rgba(200,170,150,0.75)}',
].join('')

export function ensureKidsGameAnimStyles() {
  if (document.getElementById('kids-game-anims')) return
  const style = document.createElement('style')
  style.id = 'kids-game-anims'
  style.textContent = KEYFRAMES_CSS
  document.head.appendChild(style)
}
