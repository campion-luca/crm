import { expect, test, type Page } from '@playwright/test'
import { createCompany, startEmpty } from './helpers'

const CHILDREN = ['Preparare slide', 'Inviare invito', 'Raccogliere loghi']

async function createParentWithChildren(page: Page) {
  await startEmpty(page)
  await createCompany(page, 'Belelli')
  await page.getByRole('button', { name: 'Nuova task' }).first().click()
  const dialog = page.getByRole('dialog', { name: 'Nuova task' })
  await dialog.getByLabel('Titolo').fill('Call con il cliente')
  const input = dialog.getByLabel('Nuova task collegata')
  for (const t of CHILDREN) {
    await input.fill(t)
    await input.press('Enter')
  }
  await expect(dialog.getByText('0/3')).toBeVisible()
  await dialog.getByRole('button', { name: 'Crea task' }).click()
  await expect(dialog).toBeHidden()
  await page.getByRole('link', { name: /Lista task/ }).click()
}

test('collega 3 task, completa la principale e compare la modale', async ({ page }) => {
  await createParentWithChildren(page)
  await expect(page.getByText('per: Call con il cliente')).toHaveCount(3)

  await page.getByRole('checkbox', { name: 'Segna come fatto: Call con il cliente' }).click()
  const ask = page.getByRole('dialog', { name: 'Mancano 3 task collegate' })
  await expect(ask).toBeVisible()
  for (const t of CHILDREN) await expect(ask.getByText(t)).toBeVisible()

  await ask.getByRole('button', { name: 'Completa tutte' }).click()
  await expect(ask).toBeHidden()
  await expect(page.getByText('Completata con tutte le collegate')).toBeVisible()
  for (const t of ['Call con il cliente', ...CHILDREN]) {
    await expect(page.getByRole('checkbox', { name: `Riapri: ${t}` })).toBeChecked()
  }
})

test('completata l’ultima collegata propone “Completa anche questa”', async ({ page }) => {
  await createParentWithChildren(page)
  for (const t of CHILDREN) await page.getByRole('checkbox', { name: `Segna come fatto: ${t}` }).click()
  await expect(page.getByText('Tutte le collegate di «Call con il cliente» sono fatte')).toBeVisible()
  await page.getByRole('button', { name: 'Completa anche questa' }).click()
  await expect(page.getByRole('checkbox', { name: 'Riapri: Call con il cliente' })).toBeChecked()
})

test('“Completa solo questa” lascia aperte le collegate', async ({ page }) => {
  await createParentWithChildren(page)
  await page.getByRole('checkbox', { name: 'Segna come fatto: Call con il cliente' }).click()
  await page.getByRole('button', { name: 'Completa solo questa' }).click()
  await expect(page.getByRole('checkbox', { name: 'Riapri: Call con il cliente' })).toBeChecked()
  for (const t of CHILDREN)
    await expect(page.getByRole('checkbox', { name: `Segna come fatto: ${t}` })).not.toBeChecked()
})
