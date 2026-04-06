-- Add group_name to lessons for naming recurring group lessons
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS group_name TEXT;
