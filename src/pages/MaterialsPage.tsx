import { useState } from 'react'
import { StudentVocabManager } from '@/components/students/StudentVocabManager'
import { GrammarBankManager } from '@/components/students/GrammarBankManager'
import { EikenPictureManager } from '@/components/eiken/EikenPictureManager'
import { PuzzleDeckManager } from '@/components/students/PuzzleDeckManager'
import { SituationsManager } from '@/pages/SituationsPage'
import { VRMStage } from '@/components/vrm/VRMStage'

type Tab = 'vocab' | 'grammar' | 'eiken' | 'puzzles' | 'situations' | 'vrm'

const TABS: { id: Tab; label: string }[] = [
  { id: 'vocab',      label: 'Vocabulary Decks' },
  { id: 'grammar',    label: 'Grammar Decks' },
  { id: 'eiken',      label: 'Eiken Picture Bank' },
  { id: 'puzzles',    label: 'Train Puzzles' },
  { id: 'situations', label: 'Situations' },
  { id: 'vrm',        label: 'VRM Preview' },
]

export function MaterialsPage() {
  const [tab, setTab] = useState<Tab>('vocab')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Lesson Materials</h1>
        <p className="text-sm text-gray-500 mt-1">Manage decks and teaching assets</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-brand text-brand'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'vocab'      && <StudentVocabManager />}
        {tab === 'grammar'    && <GrammarBankManager />}
        {tab === 'eiken'      && <EikenPictureManager />}
        {tab === 'puzzles'    && <PuzzleDeckManager />}
        {tab === 'situations' && <SituationsManager />}
        {tab === 'vrm'        && <VRMStage />}
      </div>
    </div>
  )
}
