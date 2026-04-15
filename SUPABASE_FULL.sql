-- ============================================
-- SRPIT: Полный SQL для Supabase
-- Запусти это в Supabase Dashboard → SQL Editor
-- ============================================

-- ============================================
-- 1. Таблица пользователей (авторизация PDA)
-- ============================================
CREATE TABLE IF NOT EXISTS users_local (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  login TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  can_access_abd BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE users_local ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own data" ON users_local;
CREATE POLICY "Users can read own data" ON users_local
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert users_local" ON users_local;
CREATE POLICY "Anyone can insert users_local" ON users_local
  FOR INSERT WITH CHECK (true);

-- Аккаунты по умолчанию
INSERT INTO users_local (login, password_hash, can_access_abd)
VALUES
  ('admin', 'admin', true),
  ('user1', '1234', false),
  ('user2', '1234', false),
  ('user3', '1234', false),
  ('user4', '1234', false)
ON CONFLICT (login) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  can_access_abd = EXCLUDED.can_access_abd;

-- ============================================
-- 2. Основная база данных (БД) — персонажи
-- ============================================
CREATE TABLE IF NOT EXISTS pda_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo TEXT,
  name TEXT,
  birthdate TEXT,
  faction TEXT,
  rank TEXT,
  status TEXT DEFAULT 'Неизвестен',
  shortinfo TEXT,
  fullinfo TEXT,
  notes TEXT,
  casenumber TEXT,
  tasks JSONB DEFAULT '[]'::jsonb,
  author_login TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pda_characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pda_characters" ON pda_characters;
CREATE POLICY "Anyone can read pda_characters" ON pda_characters
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert pda_characters" ON pda_characters;
CREATE POLICY "Anyone can insert pda_characters" ON pda_characters
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update pda_characters" ON pda_characters;
CREATE POLICY "Anyone can update pda_characters" ON pda_characters
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete pda_characters" ON pda_characters;
CREATE POLICY "Anyone can delete pda_characters" ON pda_characters
  FOR DELETE USING (true);

-- ============================================
-- 3. Записи персонажей (лента сообщений) — основная БД
-- ============================================
CREATE TABLE IF NOT EXISTS pda_character_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES pda_characters(id) ON DELETE CASCADE,
  author_login TEXT,
  content TEXT,
  entry_type TEXT DEFAULT 'note', -- 'task', 'short_info', 'full_info', 'notes', 'edit'
  is_update BOOLEAN DEFAULT false,
  target_section TEXT, -- 'full_info', 'tasks', 'short_info', 'notes'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pda_character_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read pda_character_entries" ON pda_character_entries;
CREATE POLICY "Anyone can read pda_character_entries" ON pda_character_entries
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert pda_character_entries" ON pda_character_entries;
CREATE POLICY "Anyone can insert pda_character_entries" ON pda_character_entries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update pda_character_entries" ON pda_character_entries;
CREATE POLICY "Anyone can update pda_character_entries" ON pda_character_entries
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete pda_character_entries" ON pda_character_entries;
CREATE POLICY "Anyone can delete pda_character_entries" ON pda_character_entries
  FOR DELETE USING (true);

-- Добавляем missing колонку target_task_id если её нет
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pda_character_entries' AND column_name = 'target_task_id'
  ) THEN
    ALTER TABLE pda_character_entries ADD COLUMN target_task_id UUID;
  END IF;
END $$;

-- ============================================
-- 4. Секретная база данных (АБД) — персонажи
-- ============================================
CREATE TABLE IF NOT EXISTS secret_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo TEXT,
  name TEXT,
  birthdate TEXT,
  faction TEXT,
  rank TEXT,
  status TEXT DEFAULT 'Неизвестен',
  shortinfo TEXT,
  fullinfo TEXT,
  notes TEXT,
  casenumber TEXT,
  tasks JSONB DEFAULT '[]'::jsonb,
  author_login TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE secret_characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read secret_characters" ON secret_characters;
CREATE POLICY "Anyone can read secret_characters" ON secret_characters
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert secret_characters" ON secret_characters;
CREATE POLICY "Anyone can insert secret_characters" ON secret_characters
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update secret_characters" ON secret_characters;
CREATE POLICY "Anyone can update secret_characters" ON secret_characters
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete secret_characters" ON secret_characters;
CREATE POLICY "Anyone can delete secret_characters" ON secret_characters
  FOR DELETE USING (true);

-- ============================================
-- 5. Записи персонажей (лента сообщений) — секретная БД
-- ============================================
CREATE TABLE IF NOT EXISTS secret_character_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES secret_characters(id) ON DELETE CASCADE,
  author_login TEXT,
  content TEXT,
  entry_type TEXT DEFAULT 'note', -- 'task', 'short_info', 'full_info', 'notes', 'edit'
  is_update BOOLEAN DEFAULT false,
  target_section TEXT, -- 'full_info', 'tasks', 'short_info', 'notes'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE secret_character_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read secret_character_entries" ON secret_character_entries;
CREATE POLICY "Anyone can read secret_character_entries" ON secret_character_entries
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert secret_character_entries" ON secret_character_entries;
CREATE POLICY "Anyone can insert secret_character_entries" ON secret_character_entries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update secret_character_entries" ON secret_character_entries;
CREATE POLICY "Anyone can update secret_character_entries" ON secret_character_entries
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete secret_character_entries" ON secret_character_entries;
CREATE POLICY "Anyone can delete secret_character_entries" ON secret_character_entries
  FOR DELETE USING (true);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'secret_character_entries' AND column_name = 'target_task_id'
  ) THEN
    ALTER TABLE secret_character_entries ADD COLUMN target_task_id UUID;
  END IF;
END $$;

-- ============================================
-- 6. Документы (папка)
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select_anon" ON documents;
CREATE POLICY "documents_select_anon" ON documents
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "documents_write_anon" ON documents;
CREATE POLICY "documents_write_anon" ON documents
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 7. USB файлы
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'usb_file_type') THEN
    CREATE TYPE usb_file_type AS ENUM ('photo', 'video', 'audio');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS usb_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type usb_file_type NOT NULL,
  url TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at_label TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE usb_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read usb_files" ON usb_files;
CREATE POLICY "Anyone can read usb_files" ON usb_files
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert usb_files" ON usb_files;
CREATE POLICY "Anyone can insert usb_files" ON usb_files
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 8. Бестиарий
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bestiary_entry_type') THEN
    CREATE TYPE bestiary_entry_type AS ENUM ('mutant', 'anomaly', 'artifact');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'danger_level') THEN
    CREATE TYPE danger_level AS ENUM ('низкий', 'средний', 'высокий', 'смертельный');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS bestiary_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type bestiary_entry_type NOT NULL,
  name TEXT NOT NULL,
  photos TEXT[] NOT NULL CHECK (cardinality(photos) = 2),
  short_info TEXT,
  full_info TEXT,
  danger_level danger_level,
  anomaly_names TEXT[] DEFAULT '{}',
  author_login TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bestiary_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read bestiary_entries" ON bestiary_entries;
CREATE POLICY "Anyone can read bestiary_entries" ON bestiary_entries
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert bestiary_entries" ON bestiary_entries;
CREATE POLICY "Anyone can insert bestiary_entries" ON bestiary_entries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update bestiary_entries" ON bestiary_entries;
CREATE POLICY "Anyone can update bestiary_entries" ON bestiary_entries
  FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Anyone can delete bestiary_entries" ON bestiary_entries;
CREATE POLICY "Anyone can delete bestiary_entries" ON bestiary_entries
  FOR DELETE USING (true);

-- ============================================
-- 9. Realtime publication
-- ============================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- pda_characters
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pda_characters') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE pda_characters;
    END IF;
    -- pda_character_entries
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pda_character_entries') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE pda_character_entries;
    END IF;
    -- secret_characters
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'secret_characters') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE secret_characters;
    END IF;
    -- secret_character_entries
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'secret_character_entries') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE secret_character_entries;
    END IF;
    -- bestiary_entries
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bestiary_entries') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE bestiary_entries;
    END IF;
    -- documents
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'documents') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE documents;
    END IF;
    -- usb_files
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'usb_files') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE usb_files;
    END IF;
  END IF;
END $$;

-- ============================================
-- Как дать доступ к АБД определённому аккаунту:
-- ============================================
-- UPDATE users_local SET can_access_abd = true WHERE login = 'user1';
--
-- Забрать доступ:
-- UPDATE users_local SET can_access_abd = false WHERE login = 'user1';
--
-- Проверить кто имеет доступ:
-- SELECT login, can_access_abd FROM users_local;
-- ============================================
