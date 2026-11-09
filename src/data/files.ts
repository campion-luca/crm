import { fileExt, mimeOf, type FileRef } from '@/lib/brand'
import { newId } from '@/lib/format'
import type { Client } from '@/lib/supabase'

/**
 * File del Setup aziendale (loghi, font, documenti). Percorso: `<utente>/<azienda>/<id>.<ext>`.
 * Supabase: bucket privato "brand", leggibile solo dal proprietario (policy su storage.objects).
 * Modalità locale: IndexedDB, che a differenza di localStorage regge file da qualche MB.
 */
export interface FileStore {
  upload(companyId: string, file: File): Promise<FileRef>
  /** URL da mostrare in un <img> (firmato e temporaneo con Supabase) */
  url(path: string): Promise<string>
  download(path: string): Promise<Blob>
  remove(paths: string[]): Promise<void>
  /** tutti i file di un'azienda, anche quelli rimasti orfani */
  removeCompany(companyId: string): Promise<void>
}

export const BRAND_BUCKET = 'brand'
export const MAX_FILE_MB = 25
export const SIGNED_URL_TTL = 3600

export class FileError extends Error {}

function check(file: File) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) {
    throw new FileError(`${file.name}: supera i ${MAX_FILE_MB} MB`)
  }
}

const pathFor = (owner: string, companyId: string, file: File) => {
  const ext = fileExt(file.name)
  return `${owner}/${companyId}/${newId()}${ext ? `.${ext}` : ''}`
}

const refOf = (path: string, file: File): FileRef => ({
  path,
  name: file.name,
  mime: mimeOf(file),
  size: file.size,
})

// ---------------------------------------------------------------- Supabase

const errText = (e: { message?: string } | null | undefined) => {
  const m = e?.message ?? ''
  if (/payload too large|exceeded the maximum/i.test(m)) return `file troppo grande (max ${MAX_FILE_MB} MB)`
  if (/row-level security|unauthorized|not allowed/i.test(m)) return 'permesso negato'
  return m || 'errore di rete'
}

export function createSupabaseFileStore(client: Client, userId: string): FileStore {
  const bucket = () => client.storage.from(BRAND_BUCKET)
  const store: FileStore = {
    async upload(companyId, file) {
      check(file)
      const path = pathFor(userId, companyId, file)
      const { error } = await bucket().upload(path, file, {
        contentType: mimeOf(file),
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw new FileError(`${file.name}: ${errText(error)}`)
      return refOf(path, file)
    },
    async url(path) {
      const { data, error } = await bucket().createSignedUrl(path, SIGNED_URL_TTL)
      if (error || !data) throw new FileError(errText(error))
      return data.signedUrl
    },
    async download(path) {
      const { data, error } = await bucket().download(path)
      if (error || !data) throw new FileError(errText(error))
      return data
    },
    async remove(paths) {
      if (!paths.length) return
      const { error } = await bucket().remove(paths)
      if (error) throw new FileError(errText(error))
    },
    async removeCompany(companyId) {
      const prefix = `${userId}/${companyId}`
      const { data, error } = await bucket().list(prefix, { limit: 1000 })
      if (error) throw new FileError(errText(error))
      const paths = (data ?? []).map((o) => `${prefix}/${o.name}`)
      if (paths.length) await store.remove(paths)
    },
  }
  return store
}

// ---------------------------------------------------------------- locale (IndexedDB)

const DB_NAME = 'gl-files'
const STORE = 'files'
let dbPromise: Promise<IDBDatabase> | null = null

function db(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB non disponibile'))
  })
  return dbPromise
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db()
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error ?? new Error('Errore IndexedDB'))
    tx.onabort = () => reject(tx.error ?? new FileError('Spazio del browser esaurito'))
  })
}

export function createLocalFileStore(owner = 'local'): FileStore {
  // un object URL per file, riusato finché il file esiste
  const urls = new Map<string, string>()
  const revoke = (path: string) => {
    const u = urls.get(path)
    if (u) URL.revokeObjectURL(u)
    urls.delete(path)
  }
  const get = async (path: string) => {
    const blob = await run<Blob | undefined>('readonly', (s) => s.get(path) as IDBRequest<Blob | undefined>)
    if (!blob) throw new FileError('File non trovato in questo browser')
    return blob
  }
  return {
    async upload(companyId, file) {
      check(file)
      const path = pathFor(owner, companyId, file)
      await run('readwrite', (s) => s.put(new Blob([file], { type: mimeOf(file) }), path))
      return refOf(path, file)
    },
    async url(path) {
      const cached = urls.get(path)
      if (cached) return cached
      const u = URL.createObjectURL(await get(path))
      urls.set(path, u)
      return u
    },
    download: get,
    async remove(paths) {
      for (const p of paths) {
        await run('readwrite', (s) => s.delete(p))
        revoke(p)
      }
    },
    async removeCompany(companyId) {
      const prefix = `${owner}/${companyId}/`
      await run('readwrite', (s) => s.delete(IDBKeyRange.bound(prefix, `${prefix}￿`)))
      for (const p of [...urls.keys()]) if (p.startsWith(prefix)) revoke(p)
    },
  }
}
