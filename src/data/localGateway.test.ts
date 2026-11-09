import { emptySnapshot, type UserSettings } from '@/lib/types'
import { makeCompany, makeFolder, makeTask } from '@/test/factories'
import type { Change } from './changes'
import { isNetworkError, SyncError } from './gateway'
import { createLocalGateway, LOCAL_DATA_KEY, LOCAL_SETTINGS_KEY, LOCAL_USER_ID } from './localGateway'

const setup: Change[] = [
  {
    op: 'upsert',
    table: 'companies',
    rows: [
      makeCompany({ id: 'c2', user_id: '', name: 'Belelli', position: 1 }),
      makeCompany({ id: 'c1', user_id: '', name: 'Monesi', position: 0 }),
    ],
  },
  { op: 'upsert', table: 'folders', rows: [makeFolder({ id: 'f1', user_id: '', company_id: 'c1' })] },
  {
    op: 'upsert',
    table: 'tasks',
    rows: [
      makeTask({
        id: 't1',
        user_id: '',
        company_id: 'c1',
        folder_id: 'f1',
        title: 'Carosello',
        due_time: '15:30',
      }),
      makeTask({ id: 't2', user_id: '', company_id: 'c2', title: 'Reel' }),
    ],
  },
  { op: 'upsert', table: 'task_links', rows: [{ parent_id: 't1', child_id: 't2' }] },
]

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('createLocalGateway — data', () => {
  it('is in local mode', () => {
    expect(createLocalGateway().mode).toBe('local')
  })

  it('fetchSnapshot on empty storage returns an empty snapshot', async () => {
    await expect(createLocalGateway().fetchSnapshot()).resolves.toEqual(emptySnapshot())
  })

  it('fetchSnapshot tolerates corrupted storage', async () => {
    localStorage.setItem(LOCAL_DATA_KEY, '{non json')
    await expect(createLocalGateway().fetchSnapshot()).resolves.toEqual(emptySnapshot())
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify({ companies: 'x', tasks: null }))
    await expect(createLocalGateway().fetchSnapshot()).resolves.toEqual(emptySnapshot())
  })

  it('apply persists to localStorage with the local user id', async () => {
    const gw = createLocalGateway()
    await gw.apply(setup)
    expect(localStorage.getItem(LOCAL_DATA_KEY)).not.toBeNull()

    const snap = await createLocalGateway().fetchSnapshot()
    expect(snap.companies.map((c) => c.id)).toEqual(['c1', 'c2']) // ordinate per posizione
    expect(snap.folders.map((f) => f.id)).toEqual(['f1'])
    expect(snap.tasks.map((t) => t.title)).toEqual(['Carosello', 'Reel'])
    expect(snap.links).toEqual([{ parent_id: 't1', child_id: 't2', user_id: LOCAL_USER_ID }])
    for (const r of [...snap.companies, ...snap.folders, ...snap.tasks]) expect(r.user_id).toBe(LOCAL_USER_ID)
    expect(snap.tasks[0]).toMatchObject({
      company_id: 'c1',
      folder_id: 'f1',
      due_time: '15:30',
      priority: 3,
      status: 'todo',
    })
  })

  it('successive applies build on the stored data (with cascades)', async () => {
    const gw = createLocalGateway()
    await gw.apply(setup)
    await gw.apply([{ op: 'patch', table: 'tasks', id: 't2', patch: { status: 'done' } }])
    let snap = await gw.fetchSnapshot()
    expect(snap.tasks.find((t) => t.id === 't2')!.completed_at).toEqual(expect.any(String))

    await gw.apply([{ op: 'delete', table: 'companies', ids: ['c1'] }])
    snap = await gw.fetchSnapshot()
    expect(snap.companies.map((c) => c.id)).toEqual(['c2'])
    expect(snap.folders).toEqual([])
    expect(snap.tasks.map((t) => t.id)).toEqual(['t2'])
    expect(snap.links).toEqual([])
  })

  it('constraint violations throw a non-network SyncError and leave the data unchanged', async () => {
    const gw = createLocalGateway()
    await gw.apply(setup)
    const before = localStorage.getItem(LOCAL_DATA_KEY)

    const bad: Change[][] = [
      [{ op: 'upsert', table: 'tasks', rows: [makeTask({ id: 'x', company_id: 'ghost' })] }],
      [{ op: 'upsert', table: 'tasks', rows: [makeTask({ id: 'x', company_id: 'c2', folder_id: 'f1' })] }],
      [{ op: 'upsert', table: 'folders', rows: [makeFolder({ id: 'x', company_id: 'ghost' })] }],
      [{ op: 'upsert', table: 'task_links', rows: [{ parent_id: 't2', child_id: 't1' }] }],
      [{ op: 'upsert', table: 'task_links', rows: [{ parent_id: 't1', child_id: 'ghost' }] }],
    ]
    for (const changes of bad) {
      const err = await gw.apply(changes).then(
        () => null,
        (e: unknown) => e,
      )
      expect(err).toBeInstanceOf(SyncError)
      expect((err as SyncError).network).toBe(false)
      expect(isNetworkError(err)).toBe(false)
    }
    expect(localStorage.getItem(LOCAL_DATA_KEY)).toBe(before)
  })

  it('a full browser storage becomes a SyncError', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    await expect(createLocalGateway().apply(setup)).rejects.toThrow(/Spazio del browser esaurito/)
  })
})

describe('createLocalGateway — settings', () => {
  const settings: UserSettings = {
    user_id: 'qualcuno',
    calendar_color_by: 'priority',
    horizon_days: 30,
    show_done: false,
    available_hours: 6.5,
  }

  it('fetchSettings is null when nothing was saved', async () => {
    await expect(createLocalGateway().fetchSettings()).resolves.toBeNull()
  })

  it('saveSettings / fetchSettings round trip (user id becomes local)', async () => {
    const gw = createLocalGateway()
    await gw.saveSettings(settings)
    expect(localStorage.getItem(LOCAL_SETTINGS_KEY)).not.toBeNull()
    await expect(createLocalGateway().fetchSettings()).resolves.toEqual({
      ...settings,
      user_id: LOCAL_USER_ID,
    })
  })

  it('invalid stored settings fall back to defaults field by field', async () => {
    localStorage.setItem(
      LOCAL_SETTINGS_KEY,
      JSON.stringify({ calendar_color_by: 'boh', horizon_days: 3, available_hours: 'x' }),
    )
    await expect(createLocalGateway().fetchSettings()).resolves.toEqual({
      user_id: '',
      calendar_color_by: 'company',
      horizon_days: 14,
      show_done: true,
      available_hours: 8,
    })
  })
})

describe('createLocalGateway — subscribe', () => {
  it('reports connected and resyncs on storage events for its keys', () => {
    const onResync = vi.fn()
    const onStatus = vi.fn()
    const unsubscribe = createLocalGateway().subscribe({ onChanges: vi.fn(), onResync, onStatus })
    expect(onStatus).toHaveBeenCalledWith(true)

    window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_DATA_KEY }))
    window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_SETTINGS_KEY }))
    window.dispatchEvent(new StorageEvent('storage', { key: null })) // localStorage.clear() in un'altra scheda
    window.dispatchEvent(new StorageEvent('storage', { key: 'altra-chiave' }))
    expect(onResync).toHaveBeenCalledTimes(3)

    unsubscribe()
    window.dispatchEvent(new StorageEvent('storage', { key: LOCAL_DATA_KEY }))
    expect(onResync).toHaveBeenCalledTimes(3)
  })
})
