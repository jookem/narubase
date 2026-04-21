-- Situation Simulator: NPCs, avatar presets, situations, scripts, sessions

CREATE TABLE situation_npcs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  placeholder_color text NOT NULL DEFAULT '#6366f1',
  sprites jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE avatar_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  age_group text NOT NULL CHECK (age_group IN ('children', 'teens', 'adults')),
  placeholder_color text NOT NULL DEFAULT '#f59e0b',
  image_url text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE situations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  age_groups text[] NOT NULL DEFAULT ARRAY['children', 'teens', 'adults'],
  category text NOT NULL DEFAULT 'general',
  npc_id uuid REFERENCES situation_npcs(id) ON DELETE SET NULL,
  background_color text NOT NULL DEFAULT '#e0f2fe',
  background_image_url text,
  difficulty text NOT NULL DEFAULT 'beginner' CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  mode text NOT NULL DEFAULT 'scripted' CHECK (mode IN ('scripted', 'hybrid', 'llm')),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE situation_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  situation_id uuid NOT NULL REFERENCES situations(id) ON DELETE CASCADE,
  script jsonb NOT NULL DEFAULT '{"nodes": []}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE student_situation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  situation_id uuid NOT NULL REFERENCES situations(id) ON DELETE CASCADE,
  avatar_preset_id uuid REFERENCES avatar_presets(id) ON DELETE SET NULL,
  transcript jsonb NOT NULL DEFAULT '[]',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE situation_npcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE avatar_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE situations ENABLE ROW LEVEL SECURITY;
ALTER TABLE situation_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_situation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "npcs_read_all" ON situation_npcs FOR SELECT USING (true);
CREATE POLICY "npcs_teachers_insert" ON situation_npcs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);

CREATE POLICY "avatar_presets_read_all" ON avatar_presets FOR SELECT USING (true);

CREATE POLICY "situations_read" ON situations FOR SELECT USING (
  is_active = true OR created_by = auth.uid()
);
CREATE POLICY "situations_teachers_insert" ON situations FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "situations_teachers_update" ON situations FOR UPDATE USING (
  created_by = auth.uid()
);

CREATE POLICY "scripts_read" ON situation_scripts FOR SELECT USING (
  EXISTS (SELECT 1 FROM situations WHERE id = situation_id AND (is_active = true OR created_by = auth.uid()))
);
CREATE POLICY "scripts_teachers_insert" ON situation_scripts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'teacher')
);
CREATE POLICY "scripts_teachers_update" ON situation_scripts FOR UPDATE USING (
  EXISTS (SELECT 1 FROM situations s WHERE s.id = situation_id AND s.created_by = auth.uid())
);

CREATE POLICY "sessions_student_select" ON student_situation_sessions FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "sessions_student_insert" ON student_situation_sessions FOR INSERT WITH CHECK (student_id = auth.uid());
CREATE POLICY "sessions_teacher_select" ON student_situation_sessions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM teacher_student_relationships tsr
    WHERE tsr.teacher_id = auth.uid()
      AND tsr.student_id = student_situation_sessions.student_id
      AND tsr.status = 'active'
  )
);

-- ── Seed NPCs ─────────────────────────────────────────────────────

INSERT INTO situation_npcs (id, name, role, placeholder_color) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Sam',      'Barista',       '#7c3aed'),
  ('11111111-1111-1111-1111-111111111102', 'Dr. Chen', 'Doctor',        '#059669'),
  ('11111111-1111-1111-1111-111111111103', 'Ms. Park', 'Teacher',       '#dc2626'),
  ('11111111-1111-1111-1111-111111111104', 'Alex',     'Coworker',      '#2563eb'),
  ('11111111-1111-1111-1111-111111111105', 'Maria',    'Store Clerk',   '#d97706'),
  ('11111111-1111-1111-1111-111111111106', 'Hiroshi',  'New Acquaintance', '#0891b2');

-- ── Seed avatar presets ───────────────────────────────────────────

INSERT INTO avatar_presets (name, age_group, placeholder_color, sort_order) VALUES
  ('Hana',  'children', '#f472b6', 0),
  ('Kenta', 'children', '#60a5fa', 1),
  ('Yuki',  'children', '#34d399', 2),
  ('Rin',   'teens',    '#a78bfa', 0),
  ('Sota',  'teens',    '#fb923c', 1),
  ('Mia',   'teens',    '#f43f5e', 2),
  ('Keiko', 'adults',   '#818cf8', 0),
  ('Taro',  'adults',   '#22d3ee', 1),
  ('Sara',  'adults',   '#4ade80', 2);

-- ── Seed situations ───────────────────────────────────────────────

INSERT INTO situations (id, title, description, age_groups, category, npc_id, background_color, difficulty, mode) VALUES
  (
    '22222222-2222-2222-2222-222222222201',
    'At the Café',
    'Order a drink at a coffee shop.',
    ARRAY['children', 'teens', 'adults'],
    'restaurant',
    '11111111-1111-1111-1111-111111111101',
    '#fef3c7',
    'beginner',
    'scripted'
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    'Meeting a New Friend',
    'Introduce yourself to someone new.',
    ARRAY['children', 'teens'],
    'school',
    '11111111-1111-1111-1111-111111111106',
    '#dcfce7',
    'beginner',
    'scripted'
  ),
  (
    '22222222-2222-2222-2222-222222222203',
    'At the Convenience Store',
    'Find an item and pay at the register.',
    ARRAY['teens', 'adults'],
    'shopping',
    '11111111-1111-1111-1111-111111111105',
    '#e0f2fe',
    'beginner',
    'scripted'
  );

-- ── Seed scripts ──────────────────────────────────────────────────

INSERT INTO situation_scripts (situation_id, script) VALUES
(
  '22222222-2222-2222-2222-222222222201',
  $json${
    "nodes": [
      {
        "id": "start",
        "speaker": "npc",
        "text": "Hi there! Welcome! What can I get for you today?",
        "expression": "speaking",
        "next": "s1"
      },
      {
        "id": "s1",
        "speaker": "student",
        "options": [
          { "text": "I'd like a coffee, please.", "next": "n1a" },
          { "text": "Can I have a hot chocolate?", "next": "n1b" },
          { "text": "What drinks do you have?", "next": "n1c" }
        ]
      },
      {
        "id": "n1a",
        "speaker": "npc",
        "text": "Of course! Would you like that hot or iced?",
        "expression": "positive",
        "next": "s2"
      },
      {
        "id": "n1b",
        "speaker": "npc",
        "text": "Great choice! One hot chocolate coming right up. That'll be $3.50.",
        "expression": "positive",
        "next": "end"
      },
      {
        "id": "n1c",
        "speaker": "npc",
        "text": "We have coffee, tea, juice, and hot chocolate. What sounds good?",
        "expression": "speaking",
        "next": "s1"
      },
      {
        "id": "s2",
        "speaker": "student",
        "options": [
          { "text": "Hot, please.", "next": "n2a" },
          { "text": "Iced, please.", "next": "n2b" }
        ]
      },
      {
        "id": "n2a",
        "speaker": "npc",
        "text": "Perfect! One hot coffee. That'll be $3.00.",
        "expression": "positive",
        "next": "end"
      },
      {
        "id": "n2b",
        "speaker": "npc",
        "text": "Cool! One iced coffee. That'll be $3.50.",
        "expression": "positive",
        "next": "end"
      },
      {
        "id": "end",
        "speaker": "npc",
        "text": "Here you go! Enjoy your drink! Have a great day!",
        "expression": "positive",
        "next": null
      }
    ]
  }$json$::jsonb
),
(
  '22222222-2222-2222-2222-222222222202',
  $json${
    "nodes": [
      {
        "id": "start",
        "speaker": "npc",
        "text": "Hi! I don't think we've met. I'm Hiroshi. What's your name?",
        "expression": "speaking",
        "next": "s1"
      },
      {
        "id": "s1",
        "speaker": "student",
        "options": [
          { "text": "Hi! My name is...", "next": "n1a" },
          { "text": "Hello! Nice to meet you. I'm...", "next": "n1b" }
        ]
      },
      {
        "id": "n1a",
        "speaker": "npc",
        "text": "Nice to meet you! Are you new here?",
        "expression": "positive",
        "next": "s2"
      },
      {
        "id": "n1b",
        "speaker": "npc",
        "text": "Nice to meet you too! Are you in this class?",
        "expression": "positive",
        "next": "s2"
      },
      {
        "id": "s2",
        "speaker": "student",
        "options": [
          { "text": "Yes, I just started.", "next": "n2a" },
          { "text": "No, I'm just visiting.", "next": "n2b" },
          { "text": "Yes! Do you like it here?", "next": "n2c" }
        ]
      },
      {
        "id": "n2a",
        "speaker": "npc",
        "text": "Welcome! I can show you around if you like.",
        "expression": "positive",
        "next": "end"
      },
      {
        "id": "n2b",
        "speaker": "npc",
        "text": "Oh, cool! I hope you enjoy your visit!",
        "expression": "positive",
        "next": "end"
      },
      {
        "id": "n2c",
        "speaker": "npc",
        "text": "I love it! The teachers are really nice. I think you'll like it too!",
        "expression": "positive",
        "next": "end"
      },
      {
        "id": "end",
        "speaker": "npc",
        "text": "It was great to meet you! See you around!",
        "expression": "positive",
        "next": null
      }
    ]
  }$json$::jsonb
),
(
  '22222222-2222-2222-2222-222222222203',
  $json${
    "nodes": [
      {
        "id": "start",
        "speaker": "npc",
        "text": "Welcome! Can I help you find something?",
        "expression": "speaking",
        "next": "s1"
      },
      {
        "id": "s1",
        "speaker": "student",
        "options": [
          { "text": "Yes, where are the snacks?", "next": "n1a" },
          { "text": "I'm just looking, thanks.", "next": "n1b" },
          { "text": "Do you have umbrellas?", "next": "n1c" }
        ]
      },
      {
        "id": "n1a",
        "speaker": "npc",
        "text": "The snacks are in aisle 3, on the right side.",
        "expression": "speaking",
        "next": "s2"
      },
      {
        "id": "n1b",
        "speaker": "npc",
        "text": "Of course! Let me know if you need anything.",
        "expression": "positive",
        "next": "s_pay"
      },
      {
        "id": "n1c",
        "speaker": "npc",
        "text": "Yes! Umbrellas are near the entrance, on the left.",
        "expression": "speaking",
        "next": "s2"
      },
      {
        "id": "s2",
        "speaker": "student",
        "options": [
          { "text": "Thank you!", "next": "n2a" },
          { "text": "Thanks! I'm ready to pay now.", "next": "s_pay" }
        ]
      },
      {
        "id": "n2a",
        "speaker": "npc",
        "text": "You're welcome! Come to the register when you're ready.",
        "expression": "positive",
        "next": "s_pay"
      },
      {
        "id": "s_pay",
        "speaker": "student",
        "options": [
          { "text": "I'd like to pay, please.", "next": "n_pay" },
          { "text": "Can I pay by card?", "next": "n_card" }
        ]
      },
      {
        "id": "n_pay",
        "speaker": "npc",
        "text": "Sure! That'll be $4.20 please.",
        "expression": "speaking",
        "next": "end"
      },
      {
        "id": "n_card",
        "speaker": "npc",
        "text": "Yes, we accept all cards. That'll be $4.20 please.",
        "expression": "positive",
        "next": "end"
      },
      {
        "id": "end",
        "speaker": "npc",
        "text": "Thank you! Have a great day!",
        "expression": "positive",
        "next": null
      }
    ]
  }$json$::jsonb
);
