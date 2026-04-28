-- Per-expression, per-gender VRM animation library

CREATE TABLE vrm_animations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gender     TEXT NOT NULL CHECK (gender IN ('male','female','neutral')),
  expression TEXT NOT NULL CHECK (expression IN ('neutral','happy','sad','angry','surprised','relaxed')),
  animation_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(gender, expression)
);

ALTER TABLE vrm_animations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage vrm animations"
  ON vrm_animations FOR ALL
  USING  (auth_user_role() = 'teacher')
  WITH CHECK (auth_user_role() = 'teacher');

CREATE POLICY "Authenticated read vrm animations"
  ON vrm_animations FOR SELECT TO authenticated USING (true);

-- Gender on each NPC (determines which animation set to use)
ALTER TABLE situation_npcs
  ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT 'neutral'
    CHECK (gender IN ('male','female','neutral'));

-- Gender preference on each student (determines which animation set plays for their avatar)
ALTER TABLE student_details
  ADD COLUMN IF NOT EXISTS vrm_gender TEXT NOT NULL DEFAULT 'neutral'
    CHECK (vrm_gender IN ('male','female','neutral'));

-- Storage: teachers upload animation files
CREATE POLICY "Teachers upload vrm animations"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'situation-assets'
    AND (storage.foldername(name))[1] = 'animations'
    AND auth_user_role() = 'teacher'
  );

CREATE POLICY "Teachers update vrm animations"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'situation-assets'
    AND (storage.foldername(name))[1] = 'animations'
    AND auth_user_role() = 'teacher'
  );
