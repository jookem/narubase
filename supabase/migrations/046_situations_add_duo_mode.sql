ALTER TABLE situations
  DROP CONSTRAINT situations_mode_check,
  ADD CONSTRAINT situations_mode_check CHECK (mode IN ('scripted', 'hybrid', 'llm', 'duo'));
