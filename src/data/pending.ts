/**
 * Righe con modifiche locali non ancora confermate dal server (chiave `tabella:id`).
 * Realtime e refetch non le sovrascrivono finché la mutazione non si chiude.
 */
const pending = new Map<string, number>()

export function markPending(keys: string[]) {
  for (const k of keys) pending.set(k, (pending.get(k) ?? 0) + 1)
}

export function unmarkPending(keys: string[]) {
  for (const k of keys) {
    const n = (pending.get(k) ?? 0) - 1
    if (n > 0) pending.set(k, n)
    else pending.delete(k)
  }
}

export const isPending = (key: string) => pending.has(key)
export const pendingKeys = () => new Set(pending.keys())
export const resetPending = () => pending.clear()
