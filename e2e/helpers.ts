import type { Page } from '@playwright/test'

/** Giorno in formato 'yyyy-MM-dd' (ora locale) spostato di `delta` giorni da oggi. */
export function isoDay(delta = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + delta)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Primo accesso → "Inizia da zero". */
export async function startEmpty(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Inizia da zero/ }).click()
}

/** Crea un'azienda dalla Home e finisce nel suo pannello. */
export async function createCompany(page: Page, name: string) {
  await page
    .getByRole('button', { name: /Nuova azienda/ })
    .first()
    .click()
  await page.getByLabel('Nome').fill(name)
  await page.getByRole('button', { name: 'Crea azienda' }).click()
  await page.getByRole('heading', { level: 2, name }).first().waitFor()
}

interface SeedTask {
  id: string
  title: string
  due: string
}

/**
 * Prepara i dati in localStorage prima che l'app parta (modalità locale):
 * un'azienda "Studio Test" e le task indicate.
 */
export async function seedLocal(page: Page, tasks: SeedTask[]) {
  const now = new Date().toISOString()
  const companyId = '00000000-0000-4000-8000-000000000001'
  const data = {
    companies: [
      {
        id: companyId,
        user_id: 'local',
        name: 'Studio Test',
        color: '#12b76a',
        position: 0,
        profile: {},
        brand: {},
        created_at: now,
      },
    ],
    folders: [],
    tasks: tasks.map((t, i) => ({
      id: t.id,
      user_id: 'local',
      company_id: companyId,
      folder_id: null,
      title: t.title,
      notes: '',
      link: '',
      priority: 3,
      status: 'todo',
      due_date: t.due,
      due_time: null,
      estimate_min: 30,
      checklist: [],
      completed_at: null,
      created_at: new Date(Date.now() + i).toISOString(),
      updated_at: now,
    })),
    links: [],
  }
  const settings = {
    user_id: 'local',
    calendar_color_by: 'company',
    horizon_days: 14,
    show_done: true,
    available_hours: 8,
  }
  await page.addInitScript(
    ([d, s]) => {
      if (!localStorage.getItem('gl-data-v1')) {
        localStorage.setItem('gl-data-v1', d)
        localStorage.setItem('gl-settings-v1', s)
      }
    },
    [JSON.stringify(data), JSON.stringify(settings)] as const,
  )
}
