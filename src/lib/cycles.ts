import type { TaskLink } from './types'

/** Grafo delle task collegate: parent → child (il parent si chiude dopo i child). */
export interface LinkIndex {
  children: Map<string, string[]>
  parents: Map<string, string[]>
}

export function indexLinks(links: TaskLink[]): LinkIndex {
  const children = new Map<string, string[]>()
  const parents = new Map<string, string[]>()
  for (const l of links) {
    const c = children.get(l.parent_id)
    if (c) c.push(l.child_id)
    else children.set(l.parent_id, [l.child_id])
    const p = parents.get(l.child_id)
    if (p) p.push(l.parent_id)
    else parents.set(l.child_id, [l.parent_id])
  }
  return { children, parents }
}

function walk(start: string, edges: Map<string, string[]>): Set<string> {
  const seen = new Set<string>()
  const stack = [...(edges.get(start) ?? [])]
  while (stack.length) {
    const id = stack.pop()!
    if (seen.has(id)) continue
    seen.add(id)
    for (const next of edges.get(id) ?? []) if (!seen.has(next)) stack.push(next)
  }
  return seen
}

/** Tutte le task che (direttamente o indirettamente) dipendono da `id`. */
export const ancestorsOf = (id: string, idx: LinkIndex) => walk(id, idx.parents)
/** Tutte le task da cui `id` dipende, a qualsiasi profondità. */
export const descendantsOf = (id: string, idx: LinkIndex) => walk(id, idx.children)

/**
 * Collegare parent → child crea un ciclo se il parent è già raggiungibile partendo dal child
 * (stessa regola del trigger task_links_guard nel database).
 */
export function wouldCreateCycle(parentId: string, childId: string, idx: LinkIndex): boolean {
  return parentId === childId || descendantsOf(childId, idx).has(parentId)
}

export const linkKey = (l: Pick<TaskLink, 'parent_id' | 'child_id'>) => `${l.parent_id}:${l.child_id}`
