export type UserRole = 'teacher' | 'student'
export type Locale = 'ja' | 'en'
export type RelationshipStatus = 'active' | 'paused' | 'ended'
export type GoalStatus = 'active' | 'achieved' | 'paused' | 'dropped'
export type LessonStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'
export type LessonType = 'trial' | 'regular' | 'intensive'
export type BookingStatus = 'pending' | 'approved' | 'declined' | 'withdrawn'
export type SlotType = 'recurring' | 'one_off'
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type MasteryLevel = 0 | 1 | 2 | 3

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  display_name: string | null
  email: string
  avatar_url: string | null
  timezone: string
  locale: Locale
  invite_code: string | null
  is_placeholder: boolean
  notifications_email: boolean
  default_lesson_mins: number
  created_at: string
  updated_at: string
}

export interface TeacherStudentRelationship {
  id: string
  teacher_id: string
  student_id: string
  status: RelationshipStatus
  started_at: string
  ended_at: string | null
}

export interface StudentGoal {
  id: string
  student_id: string
  teacher_id: string
  title: string
  description: string | null
  target_date: string | null
  status: GoalStatus
  created_at: string
  updated_at: string
}

export interface AvailabilitySlot {
  id: string
  teacher_id: string
  slot_type: SlotType
  day_of_week: number | null
  start_time: string
  end_time: string
  specific_date: string | null
  is_active: boolean
  created_at: string
}

export interface Lesson {
  id: string
  teacher_id: string
  student_id: string
  relationship_id: string | null
  scheduled_start: string
  scheduled_end: string
  status: LessonStatus
  lesson_type: LessonType
  meeting_url: string | null
  cancellation_reason: string | null
  cancelled_by: string | null
  cancelled_at: string | null
  created_at: string
  updated_at: string
}

export interface BookingRequest {
  id: string
  student_id: string
  teacher_id: string
  requested_start: string
  requested_end: string
  status: BookingStatus
  student_note: string | null
  teacher_note: string | null
  lesson_id: string | null
  created_at: string
  updated_at: string
}

export interface VocabularyItem {
  word: string
  definition: string
  example?: string
  mastered?: boolean
}

export interface GrammarPoint {
  point: string
  explanation: string
  examples?: string[]
}

export interface LessonNotes {
  id: string
  lesson_id: string
  author_id: string
  vocabulary: VocabularyItem[]
  grammar_points: GrammarPoint[]
  homework: string | null
  summary: string | null
  teacher_notes: string | null
  strengths: string | null
  areas_to_focus: string | null
  goal_ids: string[] | null
  is_visible_to_student: boolean
  created_at: string
  updated_at: string
}

export interface Material {
  title: string
  url?: string
  type: 'worksheet' | 'video' | 'audio' | 'book' | 'website' | 'other'
}

export interface Activity {
  name: string
  duration_minutes: number
  description?: string
}

export interface LessonPlan {
  id: string
  lesson_id: string
  teacher_id: string
  objectives: string[]
  materials: Material[]
  activities: Activity[]
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VocabularyBankEntry {
  id: string
  student_id: string
  teacher_id: string
  word: string
  reading: string | null
  definition_en: string | null
  definition_ja: string | null
  example: string | null
  image_url: string | null
  lesson_id: string | null
  mastery_level: MasteryLevel
  next_review: string | null
  created_at: string
  updated_at: string
}

export interface ProgressSnapshot {
  id: string
  student_id: string
  teacher_id: string
  snapshot_date: string
  cefr_level: CefrLevel | null
  speaking_score: number | null
  listening_score: number | null
  reading_score: number | null
  writing_score: number | null
  notes: string | null
  created_at: string
}

export interface LessonAttachment {
  id: string
  lesson_id: string
  uploader_id: string
  file_name: string
  file_size: number
  mime_type: string
  storage_path: string
  created_at: string
  url?: string | null
}

// Join types for common queries
export interface LessonWithProfiles extends Lesson {
  teacher: Pick<Profile, 'id' | 'full_name' | 'display_name' | 'avatar_url'>
  student: Pick<Profile, 'id' | 'full_name' | 'display_name' | 'avatar_url'>
}

export interface BookingRequestWithProfiles extends BookingRequest {
  student: Pick<Profile, 'id' | 'full_name' | 'display_name' | 'avatar_url'>
  teacher: Pick<Profile, 'id' | 'full_name' | 'display_name' | 'avatar_url'>
}
