-- ============================================
-- SRPIT: Полный SQL для Supabase
-- Запусти это в Supabase Dashboard → SQL Editor
-- ============================================

-- 1. Секретная база данных (АБД)
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
  tasks JSONB,
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

-- 2. Логи сообщенийей АБД (задачи, изменения)
CREATE TABLE IF NOT EXISTS secret_character_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES secret_characters(id) ON DELETE CASCADE,
  author_login TEXT,
  message TEXT,
  log_type TEXT DEFAULT 'task', -- 'task', 'note', 'edit'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE secret_character_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read secret_character_logs" ON secret_character_logs;
CREATE POLICY "Anyone can read secret_character_logs" ON secret_character_logs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert secret_character_logs" ON secret_character_logs;
CREATE POLICY "Anyone can insert secret_character_logs" ON secret_character_logs
  FOR INSERT WITH CHECK (true);

-- 3. Добавляем can_access_abd в users_local
ALTER TABLE users_local ADD COLUMN IF NOT EXISTS can_access_abd BOOLEAN DEFAULT false;

-- Только admin имеет доступ к АБД по умолчанию
UPDATE users_local SET can_access_abd = true WHERE login = 'admin';

-- 4. 5 аккаунтов для доступа к сайту и PDA
-- admin/admin — полный доступ + АБД
-- user1/1234 — без АБД
-- user2/1234 — без АБД
-- user3/1234 — без АБД
-- user4/1234 — без АБД
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

-- 5. Realtime publication — добавляем новые таблицы
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Проверяем есть ли уже таблица в публикации
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'secret_characters'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE secret_characters;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'secret_character_logs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE secret_character_logs;
    END IF;
  END IF;
END $$;

-- ============================================
-- Как дать доступ к АБД определённому аккаунту:
-- ============================================
-- Выполни в SQL Editor:
-- UPDATE users_local SET can_access_abd = true WHERE login = 'user1';
-- 
-- Забрать доступ:
-- UPDATE users_local SET can_access_abd = false WHERE login = 'user1';
-- 
-- Проверить кто имеет доступ:
-- SELECT login, can_access_abd FROM users_local;
-- ============================================
