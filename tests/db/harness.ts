import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import type { PGliteInterface } from '@electric-sql/pglite'

/**
 * Postgres reale (PGlite, WASM) con uno stub minimo di ciò che Supabase fornisce:
 * schema auth con auth.users e auth.uid() letto dal claim JWT, ruoli anon/authenticated,
 * publication supabase_realtime e le tabelle di storage usate dalle policy dei file. Poi applica le migrazioni di supabase/migrations in ordine.
 */
const MIGRATIONS_DIR = join(import.meta.dirname, '../../supabase/migrations')

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create publication supabase_realtime;

  -- Storage: tabelle e funzione usate dalle policy del bucket "brand" (RLS attiva come su Supabase)
  create schema storage;
  create table storage.buckets (
    id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets, name text not null,
    owner uuid default auth.uid(), created_at timestamptz default now(),
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language plpgsql as $$
  declare _parts text[];
  begin
    select string_to_array(name, '/') into _parts;
    return _parts[1:array_length(_parts, 1) - 1];
  end
  $$;
  grant usage on schema storage to anon, authenticated;
  grant select on storage.buckets to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
`

const GRANTS = `
  grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;
`

export async function createDb() {
  const db = new PGlite()
  await db.exec(SUPABASE_STUB)
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f: string) => f.endsWith('.sql'))
    .sort()
  for (const f of files) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, f), 'utf8'))
  }
  await db.exec(GRANTS)
  return db
}

/** Un'istanza avviata da createDb oppure una sua copia ottenuta con clone(). */
export type Db = PGliteInterface

/**
 * Avvia Postgres una sola volta (~1 s) e restituisce una funzione che ne crea copie isolate
 * (clone, ~150 ms): ogni test può partire da un database pulito senza pagare il boot.
 * `prepare` viene eseguito una volta sul template, per esempio per creare gli utenti.
 */
export async function createTemplate(prepare?: (db: Db) => Promise<void>) {
  const template = await createDb()
  if (prepare) await prepare(template)
  await template.exec('reset role')
  return {
    clone: (): Promise<Db> => template.clone(),
    close: (): Promise<void> => template.close(),
  }
}

/** Crea un utente in auth.users (come superuser) e restituisce il suo id. */
export async function createUser(db: Db, id: string) {
  await db.exec('reset role')
  await db.query('insert into auth.users (id) values ($1)', [id])
  return id
}

/** Esegue le query successive come l'utente autenticato indicato, con la RLS attiva. */
export async function actAs(db: Db, userId: string | null) {
  await db.exec('reset role')
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [userId ?? ''])
  await db.exec(userId ? 'set role authenticated' : 'set role anon')
}

export async function asSuperuser(db: Db) {
  await db.exec('reset role')
}
