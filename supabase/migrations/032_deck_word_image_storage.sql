-- Storage policies for deck word images stored at deck/{deckWordId}.webp

CREATE POLICY "Teachers can upload deck word images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'vocab-images'
    AND name LIKE 'deck/%'
    AND EXISTS (
      SELECT 1 FROM vocabulary_deck_words dw
      JOIN vocabulary_decks d ON d.id = dw.deck_id
      WHERE dw.id::text = regexp_replace(storage.filename(name), '\.webp$', '')
        AND d.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can update deck word images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'vocab-images'
    AND name LIKE 'deck/%'
    AND EXISTS (
      SELECT 1 FROM vocabulary_deck_words dw
      JOIN vocabulary_decks d ON d.id = dw.deck_id
      WHERE dw.id::text = regexp_replace(storage.filename(name), '\.webp$', '')
        AND d.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Teachers can delete deck word images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'vocab-images'
    AND name LIKE 'deck/%'
    AND EXISTS (
      SELECT 1 FROM vocabulary_deck_words dw
      JOIN vocabulary_decks d ON d.id = dw.deck_id
      WHERE dw.id::text = regexp_replace(storage.filename(name), '\.webp$', '')
        AND d.teacher_id = auth.uid()
    )
  );
