import { applyChanges } from '@/data/changes'
import { makeCompany, makeFolder, makeTask, normalizeSnapshot, snapshotOf } from '@/test/factories'
import { folderSaveChanges } from './folderChanges'

describe('folderSaveChanges', () => {
  const a = makeCompany({ id: 'co-a' })
  const b = makeCompany({ id: 'co-b' })
  const f = makeFolder({ id: 'fo-1', company_id: 'co-a', name: 'Social' })
  const t1 = makeTask({ id: 't1', company_id: 'co-a', folder_id: 'fo-1' })
  const t2 = makeTask({ id: 't2', company_id: 'co-a', folder_id: 'fo-1' })
  const other = makeTask({ id: 't3', company_id: 'co-a', folder_id: null })
  const snap = snapshotOf({ companies: [a, b], folders: [f], tasks: [t1, t2, other] })

  it('solo rinomina: una patch sulla cartella', () => {
    expect(folderSaveChanges(f, snap.tasks, 'Social dicembre', 'co-a')).toEqual([
      { op: 'patch', table: 'folders', id: 'fo-1', patch: { name: 'Social dicembre', company_id: 'co-a' } },
    ])
  })

  it("spostamento: le task seguono la cartella nell'altra azienda", () => {
    const { snapshot } = applyChanges(snap, folderSaveChanges(f, snap.tasks, 'Social', 'co-b'), {
      strict: true,
    })
    expect(snapshot.folders[0]!.company_id).toBe('co-b')
    for (const id of ['t1', 't2']) {
      const t = snapshot.tasks.find((x) => x.id === id)!
      expect(t.company_id).toBe('co-b')
      expect(t.folder_id).toBe('fo-1')
    }
    expect(snapshot.tasks.find((x) => x.id === 't3')!.company_id).toBe('co-a')
  })

  it("l'inverso è valido con i vincoli del database (strict) e riporta allo stato iniziale", () => {
    const forward = applyChanges(snap, folderSaveChanges(f, snap.tasks, 'Social', 'co-b'), { strict: true })
    const back = applyChanges(forward.snapshot, forward.inverse, { strict: true })
    expect(normalizeSnapshot(back.snapshot)).toEqual(normalizeSnapshot(snap))
  })
})
