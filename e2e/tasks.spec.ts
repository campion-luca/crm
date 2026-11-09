import { expect, test } from '@playwright/test'
import { createCompany, isoDay, seedLocal, startEmpty } from './helpers'

test('crea una task, la completa e la ritrova in Completi con l’esito', async ({ page }) => {
  await startEmpty(page)
  await createCompany(page, 'Studio Rossi')

  await page.getByRole('button', { name: 'Nuova task' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nuova task' })
  await dialog.getByLabel('Titolo').fill('Post di lancio')
  await expect(dialog.getByLabel('Scadenza *')).toHaveValue(isoDay(0)) // default oggi
  await dialog.getByRole('button', { name: 'Crea task' }).click()
  await expect(dialog).toBeHidden()

  await page.getByRole('checkbox', { name: 'Segna come fatto: Post di lancio' }).click()
  await expect(page.getByText('Spostata in Completi')).toBeVisible()

  const row = page
    .getByRole('table', { name: 'Task completate' })
    .getByRole('row')
    .filter({ hasText: 'Post di lancio' })
  await expect(row).toBeVisible()
  await expect(row.getByText('In tempo')).toBeVisible()
  await expect(row.getByText(/^Oggi, \d{2}:\d{2}$/)).toBeVisible()
})

test('completata dopo la scadenza: esito con i giorni di ritardo', async ({ page }) => {
  await seedLocal(page, [
    { id: '00000000-0000-4000-8000-0000000000a1', title: 'Brochure in ritardo', due: isoDay(-2) },
  ])
  await page.goto('/lista')
  await page.getByRole('checkbox', { name: 'Segna come fatto: Brochure in ritardo' }).click()
  await page.getByRole('link', { name: /^Home/ }).click()
  // in Home i Completi sono una lista compatta (colonna destra)
  const row = page
    .getByRole('list', { name: 'Task completate' })
    .getByRole('listitem')
    .filter({ hasText: 'Brochure in ritardo' })
  await expect(row.getByText('2 gg di ritardo')).toBeVisible()
})

test('il toast “Annulla” riapre la task completata', async ({ page }) => {
  await seedLocal(page, [
    { id: '00000000-0000-4000-8000-0000000000a2', title: 'Ottimizzare immagini', due: isoDay(1) },
  ])
  await page.goto('/lista')
  await page.getByRole('checkbox', { name: 'Segna come fatto: Ottimizzare immagini' }).click()
  await expect(page.getByRole('checkbox', { name: 'Riapri: Ottimizzare immagini' })).toBeChecked()
  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect(
    page.getByRole('checkbox', { name: 'Segna come fatto: Ottimizzare immagini' }),
  ).not.toBeChecked()
})

test('la scadenza è obbligatoria', async ({ page }) => {
  await startEmpty(page)
  await createCompany(page, 'Hybrix')
  await page.getByRole('button', { name: 'Nuova task' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nuova task' })
  await dialog.getByLabel('Titolo').fill('Senza data')
  await dialog.getByLabel('Scadenza *').fill('')
  await dialog.getByRole('button', { name: 'Crea task' }).click()
  await expect(page.getByText('Ogni task ha bisogno di una scadenza')).toBeVisible()
  await expect(dialog).toBeVisible()
})
