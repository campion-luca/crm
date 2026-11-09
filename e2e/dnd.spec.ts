import { expect, test, type Locator, type Page } from '@playwright/test'
import { isoDay, seedLocal } from './helpers'

/** Trascinamento "umano": dnd-kit si attiva dopo qualche pixel di movimento. */
async function drag(page: Page, from: Locator, to: Locator) {
  const a = await from.boundingBox()
  const b = await to.boundingBox()
  if (!a || !b) throw new Error('elemento non visibile')
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2 + 12, a.y + a.height / 2 + 4, { steps: 4 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 15 })
  await page.mouse.up()
}

test('trascina una task su un altro giorno del calendario', async ({ page }) => {
  const today = isoDay(0)
  const target = isoDay(new Date().getDate() > 20 ? -3 : 3)
  await seedLocal(page, [
    { id: '00000000-0000-4000-8000-0000000000b1', title: 'Locandina evento', due: today },
  ])
  await page.goto('/calendario')

  const source = page.locator(`[data-date="${today}"]`).getByText('Locandina evento')
  await expect(source).toBeVisible()
  await drag(page, source, page.locator(`[data-date="${target}"]`))

  await expect(page.locator(`[data-date="${target}"]`).getByText('Locandina evento')).toBeVisible()
  await expect(page.locator(`[data-date="${today}"]`).getByText('Locandina evento')).toHaveCount(0)
  await expect(page.getByText(/^Scadenza: /)).toBeVisible()

  // la modifica è salvata
  await page.reload()
  await expect(page.locator(`[data-date="${target}"]`).getByText('Locandina evento')).toBeVisible()
})

test('trascina una card della board in un’altra colonna', async ({ page }) => {
  await seedLocal(page, [
    { id: '00000000-0000-4000-8000-0000000000b2', title: 'Reel prodotto', due: isoDay(2) },
  ])
  await page.goto('/board')
  const todo = page.getByRole('region', { name: 'Da fare' })
  const doing = page.getByRole('region', { name: 'In corso' })
  await drag(page, todo.getByText('Reel prodotto'), doing)
  await expect(doing.getByText('Reel prodotto')).toBeVisible()
  await expect(page.getByText('Spostato in In corso')).toBeVisible()
})

test('il gesto indietro chiude la modale senza cambiare pagina', async ({ page }) => {
  await seedLocal(page, [
    { id: '00000000-0000-4000-8000-0000000000b3', title: 'Comunicato stampa', due: isoDay(5) },
  ])
  await page.goto('/board')
  await expect(page.getByRole('region', { name: 'Da fare' })).toBeVisible()
  await page.keyboard.press('n')
  await expect(page.getByRole('dialog', { name: 'Nuova task' })).toBeVisible()
  await page.goBack()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page).toHaveURL(/\/board$/)
})
