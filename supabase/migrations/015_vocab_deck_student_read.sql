-- Allow authenticated students to read deck names for decks they have words in.
-- Deck names (e.g. "EIKEN 5", "Unit 3") are not sensitive.
-- The previous policy used a subquery that silently returned empty under some RLS
-- configurations, causing the UI to show "Assigned Deck" for all decks.
CREATE POLICY "Authenticated users can read deck names"
  ON vocabulary_decks
  FOR SELECT
  TO authenticated
  USING (true);
