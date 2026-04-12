-- ============================================
-- SRPIT Update: АБД + Site Accounts
-- ============================================

-- 1. Секретная база данных (АБД) — структура как pda_characters
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
  author_login TEXT REFERENCES users_local(login),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Realtime для АБД
ALTER TABLE secret_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read secret_characters" ON secret_characters
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert secret_characters" ON secret_characters
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update secret_characters" ON secret_characters
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete secret_characters" ON secret_characters
  FOR DELETE USING (auth.role() = 'authenticated');

-- 2. Добавляем колонку can_access_abd в users_local для контроля доступа к АБД
ALTER TABLE users_local ADD COLUMN IF NOT EXISTS can_access_abd BOOLEAN DEFAULT false;

-- Только admin имеет доступ к АБД по умолчанию
UPDATE users_local SET can_access_abd = true WHERE login = 'admin';

-- 3. 5 аккаунтов для доступа к сайту
-- Вставляются в users_local (для PDA) + информация по site accounts:
-- admin/admin (admin роль), user1/1234, user2/1234, user3/1234, user4/1234
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

-- 4. Обновление realtime publication для новых таблиц
BEGIN;
  -- Если publication уже существует, добавляем новую таблицу
  DO $$
  BEGIN
    -- Проверяем существует ли публикация
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE secret_characters;
    END IF;
  END $$;
COMMIT;

-- ============================================
-- Примечание: Site accounts (admin/admin, user1/1234...) 
-- хранятся в коде приложения (App.tsx), не в БД.
-- PDA accounts хранятся в users_local.
-- АБД доступна только пользователям с can_access_abd = true.
-- ============================================
