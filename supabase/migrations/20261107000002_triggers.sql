-- Gestionale Lavoro · trigger e Realtime

-- updated_at sempre aggiornato dal server
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create trigger tasks_set_updated_at
  before update on public.tasks
  for each row execute function public.set_updated_at();

-- completed_at: impostato quando la task passa a 'done', azzerato quando esce da 'done'.
-- Se il client fornisce già un valore (annulla, import di un backup, coda offline) viene mantenuto,
-- così l'orario registrato è quello reale della spunta e non quello della sincronizzazione.
create or replace function public.set_completed_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'done' then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end
$$;

create trigger tasks_set_completed_at
  before insert or update on public.tasks
  for each row execute function public.set_completed_at();

-- Le FK non passano dalla RLS: senza questo controllo si potrebbe agganciare una cartella o una task
-- a un'azienda di un altro utente conoscendone l'id. La cartella deve anche appartenere alla stessa azienda.
create or replace function public.check_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- niente da verificare se i riferimenti non cambiano o se la cartella viene solo tolta:
  -- succede anche nel cascade "on delete set null" mentre si elimina l'azienda, quando l'azienda
  -- non è più visibile e il controllo fallirebbe bloccando l'eliminazione
  if tg_op = 'UPDATE' and new.company_id = old.company_id and new.user_id = old.user_id then
    if tg_table_name = 'folders' then
      return new;
    end if;
    if new.folder_id is null or new.folder_id = old.folder_id then
      return new;
    end if;
  end if;

  if not exists (select 1 from public.companies c where c.id = new.company_id and c.user_id = new.user_id) then
    raise exception 'Azienda % non trovata', new.company_id using errcode = '23503';
  end if;
  -- IF annidato: new.folder_id esiste solo su tasks e PL/pgSQL valuta il campo solo se ci arriva
  if tg_table_name = 'tasks' then
    if new.folder_id is not null and not exists (
      select 1 from public.folders f
      where f.id = new.folder_id and f.user_id = new.user_id and f.company_id = new.company_id
    ) then
      raise exception 'Cartella % non valida per l''azienda %', new.folder_id, new.company_id using errcode = '23503';
    end if;
  end if;
  return new;
end
$$;

create trigger folders_check_owner
  before insert or update of company_id, user_id on public.folders
  for each row execute function public.check_owner();

create trigger tasks_check_owner
  before insert or update of company_id, folder_id, user_id on public.tasks
  for each row execute function public.check_owner();

-- task_links: stesse verifiche di proprietà e niente cicli.
-- Rifiuta l'insert se parent_id è già raggiungibile partendo da child_id.
create or replace function public.task_links_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- serializza i collegamenti dello stesso utente: due insert concorrenti non possono creare un ciclo
  perform pg_advisory_xact_lock(hashtext('task_links:' || new.user_id::text));

  if not exists (select 1 from public.tasks t where t.id = new.parent_id and t.user_id = new.user_id)
     or not exists (select 1 from public.tasks t where t.id = new.child_id and t.user_id = new.user_id) then
    raise exception 'Task non trovata' using errcode = '23503';
  end if;

  if exists (
    with recursive reach (id) as (
      select l.child_id from public.task_links l where l.parent_id = new.child_id
      union
      select l.child_id from public.task_links l join reach r on l.parent_id = r.id
    )
    select 1 from reach where reach.id = new.parent_id
  ) then
    raise exception 'Collegamento non valido: creerebbe un ciclo' using errcode = '23514';
  end if;

  return new;
end
$$;

create trigger task_links_guard
  before insert or update on public.task_links
  for each row execute function public.task_links_guard();

-- Realtime sulle tabelle principali (la publication esiste solo su Supabase)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.companies, public.folders, public.tasks, public.task_links;
  end if;
end
$$;
