-- Change vocabulary_bank.deck_id FK from ON DELETE SET NULL to ON DELETE CASCADE
-- so deleting a deck automatically removes all student vocab entries from that deck.

ALTER TABLE vocabulary_bank
  DROP CONSTRAINT IF EXISTS vocabulary_bank_deck_id_fkey;

ALTER TABLE vocabulary_bank
  ADD CONSTRAINT vocabulary_bank_deck_id_fkey
  FOREIGN KEY (deck_id)
  REFERENCES vocabulary_decks(id)
  ON DELETE CASCADE;
