-- ============================================
-- SRPIT: Таблица записей (лента сообщений)
-- ============================================

-- Записи для АБД
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

-- Записи для основной БД (pda_characters.id — text, НЕ uuid!)
CREATE TABLE IF NOT EXISTS pda_character_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id TEXT REFERENCES pda_characters(id) ON DELETE CASCADE,
  author_login TEXT,
  content TEXT,
  entry_type TEXT DEFAULT 'note', -- 'task', 'short_info', 'full_info', 'notes', 'edit'
  is_update BOOLEAN DEFAULT false,
  target_section TEXT, -- 'full_info', 'tasks', 'short_info', 'notes'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Если таблицы уже существуют, добавляем колонку target_section
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'secret_character_entries' AND column_name = 'target_section'
  ) THEN
    -- Колонка уже существует, ничего не делаем
    NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'secret_character_entries'
  ) THEN
    ALTER TABLE secret_character_entries ADD COLUMN target_section TEXT;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pda_character_entries' AND column_name = 'target_section'
  ) THEN
    -- Колонка уже существует, ничего не делаем
    NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'pda_character_entries'
  ) THEN
    ALTER TABLE pda_character_entries ADD COLUMN target_section TEXT;
  END IF;
END $$;

ALTER TABLE secret_character_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE pda_character_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read secret_character_entries" ON secret_character_entries;
CREATE POLICY "Anyone can read secret_character_entries" ON secret_character_entries
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert secret_character_entries" ON secret_character_entries;
CREATE POLICY "Anyone can insert secret_character_entries" ON secret_character_entries
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read pda_character_entries" ON pda_character_entries;
CREATE POLICY "Anyone can read pda_character_entries" ON pda_character_entries
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Anyone can insert pda_character_entries" ON pda_character_entries;
CREATE POLICY "Anyone can insert pda_character_entries" ON pda_character_entries
  FOR INSERT WITH CHECK (true);

-- Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'secret_character_entries'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE secret_character_entries;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' AND tablename = 'pda_character_entries'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE pda_character_entries;
    END IF;
  END IF;
END $$;
