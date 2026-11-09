import { expect, test } from '@playwright/test'
import { isoDay, seedLocal } from './helpers'

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })

const COMPANY = '00000000-0000-4000-8000-000000000001'

test.beforeEach(async ({ page }) => {
  await seedLocal(
    page,
    Array.from({ length: 12 }, (_, i) => ({
      id: `00000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
      title: `Lavoro con un titolo piuttosto lungo numero ${i + 1}`,
      due: isoDay((i % 8) - 2),
    })),
  )
})

test('su telefono nessuna pagina scorre di lato', async ({ page }) => {
  for (const url of [
    '/',
    '/calendario',
    '/scadenze',
    '/aziende',
    '/board',
    '/lista',
    '/impostazioni',
    `/aziende/${COMPANY}`,
    `/aziende/${COMPANY}?tab=scheda`,
    `/aziende/${COMPANY}?tab=setup`,
  ]) {
    await page.goto(url)
    await expect(page.getByRole('navigation', { name: 'Navigazione principale' })).toBeVisible()
    const overflow = await page.evaluate(() => {
      const main = document.getElementById('main')!
      return Math.max(document.documentElement.scrollWidth - innerWidth, main.scrollWidth - main.clientWidth)
    })
    expect(overflow, url).toBeLessThanOrEqual(0)
  }
})

test('barra in basso: viste, menu e nuova task in un pannello dal basso', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigazione principale' })
  // la sidebar e il pulsante della top bar lasciano il posto alla barra in basso
  await expect(nav.getByRole('button', { name: 'Nuova task' })).toBeVisible()
  await expect(page.locator('header').getByRole('button', { name: 'Nuova task' })).toBeHidden()
  await expect(page.getByRole('complementary')).toBeHidden()

  await nav.getByRole('link', { name: 'Calendario' }).click()
  await expect(page).toHaveURL(/\/calendario$/)
  await expect(nav.getByRole('link', { name: 'Calendario' })).toHaveAttribute('aria-current', 'page')

  await nav.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Lista task' }).click()
  await expect(page).toHaveURL(/\/lista$/)
  await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0)

  // lista su due righe: titolo e azienda visibili senza tabella da scorrere
  await expect(
    page.getByRole('row').filter({ hasText: 'numero 1' }).first().getByText('Studio Test'),
  ).toBeInViewport()

  await nav.getByRole('button', { name: 'Nuova task' }).click()
  const sheet = page.getByRole('dialog', { name: 'Nuova task' })
  await expect(sheet).toBeVisible()
  await sheet.getByPlaceholder("Cosa c'è da fare?").fill('Creata dal telefono')
  await sheet
    .getByRole('button', { name: /Crea|Salva|Aggiungi/ })
    .last()
    .click()
  await expect(sheet).toHaveCount(0)
  await expect(page.getByText('Creata dal telefono').first()).toBeVisible()
})

test('calendario su telefono: pallini nelle celle, il giorno si apre col tocco', async ({ page }) => {
  await page.goto('/calendario')
  const today = page.locator(`[data-date="${isoDay(0)}"]`)
  await expect(today.locator('span.rounded-full').first()).toBeVisible()
  await today.click()
  await expect(page.getByText('Lavoro con un titolo piuttosto lungo', { exact: false }).first()).toBeVisible()
})
