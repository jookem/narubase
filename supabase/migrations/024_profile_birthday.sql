-- Add birthday to profiles table (primarily for teachers; students use student_details)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birthday DATE;
