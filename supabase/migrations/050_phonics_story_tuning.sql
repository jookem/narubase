-- Phonics Story Lab: per-page scene tuning (mascot/prop/sentence animation
-- timelines), previously a hardcoded STORY_PAGE_TUNING object in
-- storySceneTuning.ts that nothing ever actually populated — every "Copy
-- this page" output had to be hand-pasted into code and deployed, which
-- never happened, so students only ever saw buildDefaultPageTuning()
-- (idle mascot, no props) regardless of what was tuned in the Lab. Moving
-- this to the database lets the Lab's Save persist directly and show up
-- for students without a code change/deploy.
--
-- `deleted` mirrors the app's StoryPageEntry = StoryPageTuning | 'deleted'
-- sentinel (see StoryLab.tsx's deleteScene): a page can be explicitly
-- removed even within a unit's static phonicsContent.ts page range.
CREATE TABLE phonics_story_tuning (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id     text NOT NULL,
  page_index  integer NOT NULL CHECK (page_index >= 0),
  tuning      jsonb,
  deleted     boolean NOT NULL DEFAULT false,
  updated_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (unit_id, page_index),
  CHECK (deleted OR tuning IS NOT NULL)
);

CREATE TRIGGER phonics_story_tuning_updated_at
  BEFORE UPDATE ON phonics_story_tuning
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE phonics_story_tuning ENABLE ROW LEVEL SECURITY;

-- Shared curriculum content, not per-student/per-teacher data — every
-- signed-in user (teacher previewing in the Lab, student playing the game)
-- needs to read it.
CREATE POLICY "phonics_story_tuning_read_all"
  ON phonics_story_tuning FOR SELECT
  TO authenticated
  USING (true);

-- Any teacher can author it (it's shared, unowned curriculum content, same
-- model as situation_npcs/avatar_presets) — not scoped to a single teacher.
CREATE POLICY "phonics_story_tuning_teachers_write"
  ON phonics_story_tuning FOR ALL
  TO authenticated
  USING (auth_user_role() = 'teacher')
  WITH CHECK (auth_user_role() = 'teacher');
