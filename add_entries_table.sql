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
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Записи для основной БД
CREATE TABLE IF NOT EXISTS pda_character_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES pda_characters(id) ON DELETE CASCADE,
  author_login TEXT,
  content TEXT,
  entry_type TEXT DEFAULT 'note', -- 'task', 'short_info', 'full_info', 'notes', 'edit'
  is_update BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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
