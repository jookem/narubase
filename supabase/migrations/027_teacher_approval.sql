-- Add approval_status to profiles for teacher account moderation
ALTER TABLE profiles
  ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Update trigger so new teacher accounts start as pending
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name, email, approval_status)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'role',
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    CASE WHEN NEW.raw_user_meta_data->>'role' = 'teacher' THEN 'pending' ELSE 'approved' END
  );
  RETURN NEW;
END;
$$;

-- Allow admin (tegamikureru@gmail.com) to update approval_status on any profile
CREATE POLICY "Admin can update approval_status"
  ON profiles FOR UPDATE
  USING (auth.email() = 'tegamikureru@gmail.com')
  WITH CHECK (auth.email() = 'tegamikureru@gmail.com');
