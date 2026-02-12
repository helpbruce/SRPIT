-- SQL для настройки политик RLS для таблицы documents
-- Выполни этот запрос в Supabase → SQL Editor

-- 🔹 documents
alter table public.documents enable row level security;

drop policy if exists "documents_select_anon" on public.documents;
drop policy if exists "documents_write_anon"  on public.documents;

create policy "documents_select_anon"
on public.documents
for select
to anon
using (true);

create policy "documents_write_anon"
on public.documents
for all
to anon
using (true)
with check (true);

-- После выполнения этого SQL:
-- 1. Включи Realtime для таблицы documents:
--    Table Editor → documents → Replication → включи INSERT, UPDATE, DELETE
-- 2. Убедись что таблица documents имеет колонки: id (uuid), url (text), created_at (timestamp)
