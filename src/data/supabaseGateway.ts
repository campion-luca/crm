import type { PostgrestError, RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '@/lib/database.types'
import { linkKey } from '@/lib/cycles'
import type { Snapshot, UserSettings } from '@/lib/types'
import type { Change } from './changes'
import { createSupabaseFileStore } from './files'
import { SyncError, type Gateway, type GatewayHandlers } from './gateway'
import { byPosition, toCompany, toFolder, toLink, toSettings, toTask } from './normalize'

type Client = SupabaseClient<Database>
type TableName = 'companies' | 'folders' | 'tasks' | 'task_links'

const PAGE = 1000 // limite di righe di PostgREST

function toSyncError(error: PostgrestError | Error): SyncError {
  const msg = error.message || 'Errore di sincronizzazione'
  const network = /fetch|network|load failed|timeout/i.test(msg) && !('code' in error && error.code)
  return new SyncError(msg, network)
}

export function createSupabaseGateway(client: Client, userId: string): Gateway {
  /** Tutte le righe di una tabella, a pagine da 1000 (la RLS restituisce solo quelle dell'utente). */
  async function fetchAll(table: TableName, order: string[]): Promise<Record<string, unknown>[]> {
    const rows: Record<string, unknown>[] = []
    for (let from = 0; ; from += PAGE) {
      let q = client.from(table).select('*')
      for (const col of order) q = q.order(col)
      const { data, error } = await q.range(from, from + PAGE - 1)
      if (error) throw toSyncError(error)
      const page = (data ?? []) as unknown as Record<string, unknown>[]
      rows.push(...page)
      if (page.length < PAGE) break
    }
    return rows
  }

  return {
    mode: 'supabase',
    files: createSupabaseFileStore(client, userId),

    async fetchSnapshot(): Promise<Snapshot> {
      const [companies, folders, tasks, links] = await Promise.all([
        fetchAll('companies', ['position', 'created_at', 'id']),
        fetchAll('folders', ['position', 'created_at', 'id']),
        fetchAll('tasks', ['created_at', 'id']),
        fetchAll('task_links', ['parent_id', 'child_id']),
      ])
      return {
        companies: companies.map(toCompany).sort(byPosition),
        folders: folders.map(toFolder).sort(byPosition),
        tasks: tasks.map(toTask),
        links: links.map(toLink),
      }
    },

    async apply(changes: Change[]) {
      const { error } = await client.rpc('apply_changes', { changes: changes as unknown as Json })
      if (error) throw toSyncError(error)
    },

    async fetchSettings() {
      const { data, error } = await client.from('user_settings').select('*').maybeSingle()
      if (error) throw toSyncError(error)
      return data ? toSettings(data) : null
    },

    async saveSettings(s: UserSettings) {
      const { error } = await client.from('user_settings').upsert({ ...s, user_id: userId })
      if (error) throw toSyncError(error)
    },

    subscribe(h: GatewayHandlers) {
      let lost = false
      const channel = client.channel(`gl-${userId}`)
      type Payload = RealtimePostgresChangesPayload<Record<string, unknown>>

      const toChange = (table: TableName, p: Payload): Change | null => {
        if (p.eventType === 'DELETE') {
          const old = p.old
          if (table === 'task_links') {
            if (!old.parent_id || !old.child_id) return null
            return {
              op: 'delete',
              table,
              keys: [{ parent_id: String(old.parent_id), child_id: String(old.child_id) }],
            }
          }
          return old.id ? { op: 'delete', table, ids: [String(old.id)] } : null
        }
        const row = p.new
        switch (table) {
          case 'companies':
            return { op: 'upsert', table, rows: [toCompany(row)] }
          case 'folders':
            return { op: 'upsert', table, rows: [toFolder(row)] }
          case 'tasks':
            return { op: 'upsert', table, rows: [toTask(row)] }
          case 'task_links': {
            const l = toLink(row)
            return linkKey(l)
              ? { op: 'upsert', table, rows: [{ parent_id: l.parent_id, child_id: l.child_id }] }
              : null
          }
        }
      }

      for (const table of ['companies', 'folders', 'tasks', 'task_links'] as const) {
        const handler = (p: Payload) => {
          const ch = toChange(table, p)
          if (ch) h.onChanges([ch])
        }
        const filter = `user_id=eq.${userId}`
        channel
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, handler)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, handler)
          // i DELETE non si possono filtrare: la RLS fa arrivare solo quelli dell'utente
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, handler)
      }

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          h.onStatus?.(true)
          if (lost) h.onResync()
          lost = false
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          lost = true
          h.onStatus?.(false)
        }
      })

      return () => {
        void client.removeChannel(channel)
      }
    },
  }
}
