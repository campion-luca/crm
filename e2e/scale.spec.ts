import { expect, test } from '@playwright/test'
import { isoDay, seedLocal } from './helpers'

/** Oltre ~150 righe le liste si virtualizzano: devono comunque mostrare le righe e funzionare. */
test('con 300 task la lista virtualizzata mostra le righe e la spunta funziona', async ({ page }) => {
  const tasks = Array.from({ length: 300 }, (_, i) => ({
    id: `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`,
    title: `Task in serie ${String(i + 1).padStart(3, '0')}`,
    due: isoDay((i % 40) - 5),
  }))
  await seedLocal(page, tasks)
  await page.goto('/lista')

  const rows = page.getByRole('table', { name: 'Lista task' }).getByRole('checkbox')
  await expect(rows.first()).toBeVisible()
  const inDom = await rows.count()
  expect(inDom).toBeGreaterThan(5)
  expect(inDom).toBeLessThan(300) // virtualizzata: non tutte nel DOM

  const first = rows.first()
  const label = (await first.getAttribute('aria-label'))!.replace('Segna come fatto: ', '')
  await first.click()
  await expect(page.getByText('Spostata in Completi')).toBeVisible()
  // completata, scende in fondo al suo gruppo (fuori dalla finestra virtualizzata)
  await expect(page.getByRole('checkbox', { name: `Segna come fatto: ${label}` })).toHaveCount(0)

  // scorrendo in fondo compaiono anche le ultime righe
  await page.locator('#main').evaluate((el) => el.scrollTo(0, el.scrollHeight))
  await expect(page.getByRole('table', { name: 'Lista task' }).getByRole('row').last()).toBeVisible()
})
