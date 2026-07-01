import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  getPhonicsProgress, addPhonicsWordsToBank, getPhonicsWordBankRows,
  type PhonicsProgressRow, type PhonicsBankRow,
} from '@/lib/api/phonics'
import { PHONICS_UNITS, type PhonicsUnit, type PhonicsWord } from '@/lib/phonicsContent'
import { WorldMap } from './WorldMap'
import { WordBuilder } from './WordBuilder'
import { FamilyMatch } from './FamilyMatch'
import { StoryReader } from './StoryReader'
import { SrsCheckpoint } from './SrsCheckpoint'
import { LevelComplete } from './LevelComplete'

const FONT = "'M PLUS Rounded 1c', system-ui, sans-serif"

type View = 'map' | 'builder' | 'match' | 'story' | 'checkpoint' | 'complete'
type CheckpointCard = PhonicsBankRow & { jp: string }

function nextUnit(unit: PhonicsUnit): PhonicsUnit | null {
  return PHONICS_UNITS.find(u => u.world === unit.world && u.indexInWorld === unit.indexInWorld + 1) ?? null
}

function LevelHeader({ unit, onMap }: { unit: PhonicsUnit; onMap: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#6B4F3F' }}>{unit.mascotEmoji} {unit.mascotName}'s "{unit.rime}" level</div>
      <button
        onClick={onMap}
        style={{ border: 'none', cursor: 'pointer', fontFamily: FONT, fontWeight: 700, fontSize: 13, padding: '6px 14px', borderRadius: '999px', background: '#FFFFFF', color: '#6B4F3F', boxShadow: '0 3px 0 #E7D3C0' }}>
        ← Map
      </button>
    </div>
  )
}

// Top-level orchestrator for Phonics Quest, mounted by KidsGame.tsx (which
// already renders its own persistent "← Home" back button above every
// non-hub screen, so this component doesn't need its own). Full level loop:
// map -> Sound Intro (folded into the builder's first reveal) -> Word
// Builder -> Family Match -> Story Reader -> SRS Checkpoint -> Level
// Complete -> back to map with updated progress.
export function PhonicsGame() {
  const { user } = useAuth()
  const [progress, setProgress] = useState<Record<string, PhonicsProgressRow>>({})
  const [view, setView] = useState<View>('map')
  const [selectedUnit, setSelectedUnit] = useState<PhonicsUnit | null>(null)
  const [collectedWords, setCollectedWords] = useState<PhonicsWord[]>([])
  const [matchResult, setMatchResult] = useState<{ stars: number; flips: number } | null>(null)
  const [checkpointCards, setCheckpointCards] = useState<CheckpointCard[] | null>(null)
  const [srsScore, setSrsScore] = useState<number | null>(null)

  useEffect(() => {
    if (!user) return
    getPhonicsProgress(user.id).then(({ progress }) => setProgress(progress))
  }, [user])

  function startUnit(unit: PhonicsUnit) {
    setSelectedUnit(unit)
    setCollectedWords([])
    setMatchResult(null)
    setCheckpointCards(null)
    setSrsScore(null)
    setView('builder')
  }

  async function startCheckpoint(words: PhonicsWord[]) {
    setView('checkpoint')
    setCheckpointCards(null)
    if (!user) return
    await addPhonicsWordsToBank(user.id, words.map(w => ({ word: w.word, definition_ja: w.jp })))
    const { rows } = await getPhonicsWordBankRows(user.id, words.map(w => w.word))
    setCheckpointCards(rows.map(r => ({ ...r, jp: words.find(w => w.word === r.word)?.jp ?? '' })))
  }

  if (view === 'builder' && selectedUnit) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 16px 20px', fontFamily: FONT }}>
        <LevelHeader unit={selectedUnit} onMap={() => setView('map')} />
        <WordBuilder
          unit={selectedUnit}
          onAllOnsetsUsed={words => { setCollectedWords(words); setView('match') }}
        />
      </div>
    )
  }

  if (view === 'match' && selectedUnit) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 16px 20px', fontFamily: FONT }}>
        <LevelHeader unit={selectedUnit} onMap={() => setView('map')} />
        <FamilyMatch
          words={collectedWords}
          onComplete={(stars, flips) => { setMatchResult({ stars, flips }); setView('story') }}
        />
      </div>
    )
  }

  if (view === 'story' && selectedUnit) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 16px 20px', fontFamily: FONT }}>
        <LevelHeader unit={selectedUnit} onMap={() => setView('map')} />
        <StoryReader unit={selectedUnit} onDone={() => startCheckpoint(collectedWords)} />
      </div>
    )
  }

  if (view === 'checkpoint' && selectedUnit) {
    return (
      <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 16px 20px', fontFamily: FONT }}>
        <LevelHeader unit={selectedUnit} onMap={() => setView('map')} />
        {checkpointCards === null ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#A98B77', fontWeight: 700 }}>Getting your words ready…</div>
        ) : (
          <SrsCheckpoint
            words={checkpointCards}
            onDone={score => { setSrsScore(score); setView('complete') }}
          />
        )}
      </div>
    )
  }

  if (view === 'complete' && selectedUnit && matchResult && srsScore !== null) {
    const upcoming = nextUnit(selectedUnit)
    return (
      <LevelComplete
        unit={selectedUnit}
        matchStars={matchResult.stars}
        srsScore={srsScore}
        wordsLearned={collectedWords}
        hasNextUnit={!!upcoming}
        onNext={() => upcoming && startUnit(upcoming)}
        onMap={() => setView('map')}
        onStarsRecorded={(unitId, stars) => setProgress(p => ({
          ...p,
          [unitId]: { unit_id: unitId, stars, attempts: (p[unitId]?.attempts ?? 0) + 1, completed_at: new Date().toISOString() },
        }))}
      />
    )
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 16px 20px', fontFamily: FONT }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: '#6B4F3F' }}>Phonics Quest 🦆</div>
        <div style={{ fontSize: 12, color: '#A98B77' }}>フォニックス・クエスト</div>
      </div>
      <WorldMap progress={progress} onSelectUnit={startUnit} />
    </div>
  )
}
