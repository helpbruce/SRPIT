-- Supabase schema for BestPass web app

-- Documents shown in folder (App.tsx / DocumentStack)
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  created_at timestamptz not null default now()
);

-- USB files (USBModal)
create type usb_file_type as enum ('photo', 'video', 'audio');

create table if not exists usb_files (
  id uuid primary key default gen_random_uuid(),
  type usb_file_type not null,
  url text not null,
  name text not null,
  -- stored as DD.MM.2009 to keep original UI format
  created_at_label text not null,
  created_at timestamptz not null default now()
);

-- PDA characters (PDAModal database)
create table if not exists pda_characters (
  id uuid primary key,
  photo text not null,
  name text not null,
  birth_date text,
  faction text,
  rank text,
  status text,
  short_info text,
  full_info text,
  notes text,
  case_number text,
  tasks jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- Bestiary entries (PDAModal bestiary)
create type bestiary_entry_type as enum ('mutant', 'anomaly', 'artifact');
create type danger_level as enum ('низкий', 'средний', 'высокий', 'смертельный');

create table if not exists bestiary_entries (
  id uuid primary key,
  type bestiary_entry_type not null,
  name text not null,
  photos text[] not null check (cardinality(photos) = 2),
  short_info text,
  full_info text,
  danger_level danger_level,
  anomaly_names text[] default '{}',
  updated_at timestamptz not null default now()
);

-- Map markers and drawings (MapModal)
create table if not exists map_markers (
  id uuid primary key default gen_random_uuid(),
  marker jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists map_drawings (
  id uuid primary key default gen_random_uuid(),
  path jsonb not null,
  created_at timestamptz not null default now()
);

