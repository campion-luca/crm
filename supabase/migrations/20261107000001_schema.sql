-- Gestionale Lavoro · schema, indici e Row Level Security
-- Ogni riga appartiene a un utente (user_id) e ogni policy limita l'accesso alle sue righe.

create type public.task_status as enum ('todo', 'doing', 'review', 'done');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 120),
  color text not null check (color ~* '^#[0-9a-f]{6}$'),
  position int not null default 0,
  profile jsonb not null default '{}' check (jsonb_typeof(profile) = 'object'),
  created_at timestamptz not null default now()
);

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  name text not null check (length(name) between 1 and 120),
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  company_id uuid not null references public.companies on delete cascade,
  folder_id uuid references public.folders on delete set null,
  title text not null check (length(title) between 1 and 300),
  notes text not null default '',
  link text not null default '',
  priority smallint not null default 3 check (priority between 1 and 5), -- 1 = più urgente
  status public.task_status not null default 'todo',
  due_date date not null,
  due_time time,
  estimate_min int not null default 0 check (estimate_min >= 0),
  checklist jsonb not null default '[]' check (jsonb_typeof(checklist) = 'array'), -- [{id,text,done}]
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- task collegate: il parent si chiude dopo aver completato i child
create table public.task_links (
  parent_id uuid not null references public.tasks on delete cascade,
  child_id uuid not null references public.tasks on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (parent_id, child_id),
  check (parent_id <> child_id)
);

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  calendar_color_by text not null default 'company' check (calendar_color_by in ('company', 'priority')),
  horizon_days int not null default 14 check (horizon_days in (7, 14, 30, 60)),
  show_done boolean not null default true,
  available_hours numeric not null default 8 check (available_hours between 0 and 24)
);

-- indici richiesti
create index tasks_user_due_idx on public.tasks (user_id, due_date);
create index tasks_company_status_idx on public.tasks (company_id, status);
create index tasks_user_completed_idx on public.tasks (user_id, completed_at desc) where status = 'done';
create index task_links_child_idx on public.task_links (child_id);
-- indici di supporto per le FK (cascade veloci) e per il caricamento per utente
create index companies_user_idx on public.companies (user_id, position);
create index folders_company_idx on public.folders (company_id);
create index folders_user_idx on public.folders (user_id);
create index tasks_folder_idx on public.tasks (folder_id);
create index task_links_user_idx on public.task_links (user_id);

-- Row Level Security: select, insert, update e delete solo sulle proprie righe
do $$
declare
  t text;
begin
  foreach t in array array['companies', 'folders', 'tasks', 'task_links', 'user_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end
$$;
