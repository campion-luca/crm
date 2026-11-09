-- Gestionale Lavoro · Setup aziendale
--
-- companies.brand (jsonb): logo, colori, font, tono di voce e documenti dell'azienda.
--   { "logos":  [ { "id", "label", "file": { "path", "name", "mime", "size" }, "bg": "light"|"dark", "w", "h" } ],
--     "avatar": "data:image/webp;base64,…",   miniatura del logo usata come avatar nell'app
--     "colors": [ { "id", "name", "hex", "role", "note" } ],
--     "fonts":  [ { "id", "family", "role", "weights", "url", "files": [ { …file, "style" } ] } ],
--     "payoff", "tone", "hashtags", "guidelines",
--     "docs":   [ { "id", "label", "url" | "file" } ] }
-- I file stanno nel bucket privato "brand" (migrazione successiva); qui solo i riferimenti.
-- I vecchi profile.brandColors / profile.fonts vengono letti dal client finché il setup non viene salvato.

alter table public.companies
  add column brand jsonb not null default '{}' check (jsonb_typeof(brand) = 'object');

-- apply_changes con la nuova colonna (stesso contratto della migrazione precedente)
create or replace function public.apply_changes(changes jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ch jsonb;
  rows_in jsonb;
  patch_in jsonb;
  tbl text;
  op text;
  uid uuid := auth.uid();
  c_rec public.companies%rowtype;
  f_rec public.folders%rowtype;
  t_rec public.tasks%rowtype;
begin
  if uid is null then
    raise exception 'Utente non autenticato' using errcode = '42501';
  end if;
  if jsonb_typeof(changes) is distinct from 'array' then
    raise exception 'changes deve essere un array' using errcode = '22023';
  end if;

  for ch in select value from jsonb_array_elements(changes) loop
    tbl := ch ->> 'table';
    op := ch ->> 'op';
    -- user_id non si accetta dal client (è sempre auth.uid()): va tolto prima della conversione,
    -- anche perché le righe create in modo ottimistico hanno user_id = '' (non è un uuid valido)
    if op = 'upsert' and jsonb_typeof(ch -> 'rows') is distinct from 'array' then
      raise exception 'rows deve essere un array' using errcode = '22023';
    end if;
    rows_in := (
      select coalesce(jsonb_agg(e - 'user_id'), '[]'::jsonb)
      from jsonb_array_elements(case when jsonb_typeof(ch -> 'rows') = 'array' then ch -> 'rows' else '[]'::jsonb end) e
    );
    patch_in := coalesce(ch -> 'patch', '{}'::jsonb) - 'user_id' - 'id';

    -- ---------- upsert ----------
    if op = 'upsert' and tbl = 'companies' then
      insert into public.companies (id, user_id, name, color, position, profile, brand, created_at)
      select r.id, uid, r.name, r.color, coalesce(r.position, 0), coalesce(r.profile, '{}'::jsonb),
             coalesce(r.brand, '{}'::jsonb), coalesce(r.created_at, now())
      from jsonb_populate_recordset(null::public.companies, rows_in) r
      on conflict (id) do update
        set name = excluded.name, color = excluded.color, position = excluded.position,
            profile = excluded.profile, brand = excluded.brand;

    elsif op = 'upsert' and tbl = 'folders' then
      insert into public.folders (id, user_id, company_id, name, position, created_at)
      select r.id, uid, r.company_id, r.name, coalesce(r.position, 0), coalesce(r.created_at, now())
      from jsonb_populate_recordset(null::public.folders, rows_in) r
      on conflict (id) do update
        set company_id = excluded.company_id, name = excluded.name, position = excluded.position;

    elsif op = 'upsert' and tbl = 'tasks' then
      insert into public.tasks (
        id, user_id, company_id, folder_id, title, notes, link, priority, status, due_date, due_time,
        estimate_min, checklist, completed_at, created_at
      )
      select r.id, uid, r.company_id, r.folder_id, r.title, coalesce(r.notes, ''), coalesce(r.link, ''),
             coalesce(r.priority, 3), coalesce(r.status, 'todo'), r.due_date, r.due_time,
             coalesce(r.estimate_min, 0), coalesce(r.checklist, '[]'::jsonb), r.completed_at,
             coalesce(r.created_at, now())
      from jsonb_populate_recordset(null::public.tasks, rows_in) r
      on conflict (id) do update
        set company_id = excluded.company_id, folder_id = excluded.folder_id, title = excluded.title,
            notes = excluded.notes, link = excluded.link, priority = excluded.priority,
            status = excluded.status, due_date = excluded.due_date, due_time = excluded.due_time,
            estimate_min = excluded.estimate_min, checklist = excluded.checklist,
            completed_at = excluded.completed_at;

    elsif op = 'upsert' and tbl = 'task_links' then
      insert into public.task_links (parent_id, child_id, user_id)
      select k.parent_id, k.child_id, uid
      from jsonb_to_recordset(ch -> 'rows') as k (parent_id uuid, child_id uuid)
      on conflict do nothing;

    -- ---------- patch (solo i campi presenti; una riga sparita nel frattempo viene ignorata) ----------
    -- il WHERE usa ch.id e non il record: un "id" dentro patch sovrascriverebbe un'altra riga
    elsif op = 'patch' and tbl = 'companies' then
      select * into c_rec from public.companies where id = (ch ->> 'id')::uuid for update;
      if found then
        c_rec := jsonb_populate_record(c_rec, patch_in);
        update public.companies
          set name = c_rec.name, color = c_rec.color, position = c_rec.position, profile = c_rec.profile,
              brand = c_rec.brand
          where id = (ch ->> 'id')::uuid;
      end if;

    elsif op = 'patch' and tbl = 'folders' then
      select * into f_rec from public.folders where id = (ch ->> 'id')::uuid for update;
      if found then
        f_rec := jsonb_populate_record(f_rec, patch_in);
        update public.folders
          set company_id = f_rec.company_id, name = f_rec.name, position = f_rec.position
          where id = (ch ->> 'id')::uuid;
      end if;

    elsif op = 'patch' and tbl = 'tasks' then
      select * into t_rec from public.tasks where id = (ch ->> 'id')::uuid for update;
      if found then
        t_rec := jsonb_populate_record(t_rec, patch_in);
        update public.tasks
          set company_id = t_rec.company_id, folder_id = t_rec.folder_id, title = t_rec.title,
              notes = t_rec.notes, link = t_rec.link, priority = t_rec.priority, status = t_rec.status,
              due_date = t_rec.due_date, due_time = t_rec.due_time, estimate_min = t_rec.estimate_min,
              checklist = t_rec.checklist, completed_at = t_rec.completed_at
          where id = (ch ->> 'id')::uuid;
      end if;

    -- ---------- delete (i cascade dello schema eliminano cartelle, task e collegamenti) ----------
    elsif op = 'delete' and tbl in ('companies', 'folders', 'tasks') then
      execute format('delete from public.%I where id = any($1)', tbl)
        using array(select jsonb_array_elements_text(ch -> 'ids')::uuid);

    elsif op = 'delete' and tbl = 'task_links' then
      delete from public.task_links l
        using jsonb_to_recordset(ch -> 'keys') as k (parent_id uuid, child_id uuid)
        where l.parent_id = k.parent_id and l.child_id = k.child_id;

    else
      raise exception 'Operazione non supportata: % su %', op, tbl using errcode = '22023';
    end if;
  end loop;
end
$$;

revoke all on function public.apply_changes(jsonb) from public, anon;
grant execute on function public.apply_changes(jsonb) to authenticated;
