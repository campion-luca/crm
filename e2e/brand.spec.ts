/// <reference lib="dom" />
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { seedLocal } from './helpers'

const COMPANY = '00000000-0000-4000-8000-000000000001'

const logoSvg = (fill: string) =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80"><rect width="240" height="80" rx="16" fill="${fill}"/><circle cx="40" cy="40" r="22" fill="#fff"/></svg>`,
  )

const fontFile = readFileSync(
  join(
    import.meta.dirname,
    '../node_modules/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2',
  ),
)

async function openSetup(page: Page) {
  await seedLocal(page, [])
  await page.goto(`/aziende/${COMPANY}?tab=setup`)
  await expect(page.getByRole('tab', { name: 'Setup aziendale' })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('heading', { name: 'Logo', exact: true })).toBeVisible()
}

/** Il modulo (section) più vicino al titolo indicato. */
const section = (page: Page, title: string) =>
  page.getByRole('heading', { name: title, exact: true }).locator('xpath=ancestor::section[1]')

test('logo: caricamento, avatar dell’azienda, eliminazione con annulla', async ({ page }) => {
  await openSetup(page)
  const logos = section(page, 'Logo')

  await logos
    .locator('input[type=file]')
    .first()
    .setInputFiles({ name: 'logo-studio.svg', mimeType: 'image/svg+xml', buffer: logoSvg('#12b76a') })

  const img = logos.getByRole('img', { name: 'Logo principale di Studio Test' })
  await expect(img).toBeVisible()
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0)
  await expect(logos.getByText('SVG · 240×80')).toBeVisible()

  // il primo logo diventa l'avatar: nell'intestazione del pannello compare la miniatura
  const avatar = page.locator('section img[src^="data:image/"]').first()
  await expect(avatar).toBeVisible()
  await expect(logos.getByRole('button', { name: 'Togli come avatar dell’azienda' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  // fondo scuro per la versione in negativo
  await logos.getByRole('button', { name: /Mostra su fondo scuro/ }).click()
  await expect(logos.getByRole('button', { name: 'Mostra su fondo chiaro' })).toBeVisible()

  // rinomina
  await logos.getByRole('button', { name: 'Logo principale', exact: true }).click()
  await logos.getByLabel('Nome del logo').fill('Logo negativo')
  await logos.getByLabel('Nome del logo').press('Enter')
  await expect(logos.getByRole('img', { name: 'Logo negativo di Studio Test' })).toBeVisible()

  // elimina → annulla → torna, avatar compreso
  await logos.getByRole('button', { name: 'Elimina Logo negativo' }).click()
  await expect(logos.getByRole('img', { name: /Logo negativo/ })).toHaveCount(0)
  await expect(page.locator('section img[src^="data:image/"]')).toHaveCount(0)
  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect(logos.getByRole('img', { name: 'Logo negativo di Studio Test' })).toBeVisible()
  await expect(page.locator('section img[src^="data:image/"]').first()).toBeVisible()

  // dopo un ricaricamento il file è ancora lì (IndexedDB) e l'avatar anche
  await page.reload()
  await expect(section(page, 'Logo').getByRole('img', { name: 'Logo negativo di Studio Test' })).toBeVisible()
  await expect(page.locator('section img[src^="data:image/"]').first()).toBeVisible()

  // l'avatar compare anche nella pagina Aziende
  await page.goto('/aziende')
  await expect(page.locator('article img[src^="data:image/"]').first()).toBeVisible()
})

test('colori: aggiunta, copia, colore dell’azienda e contrasto', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openSetup(page)
  const colors = section(page, 'Colori')

  await colors.getByRole('button', { name: 'Aggiungi colore' }).click()
  const dialog = page.getByRole('dialog', { name: 'Nuovo colore' })
  await dialog.getByLabel('Nome').fill('Blu notte')
  await dialog.getByLabel('Colore', { exact: true }).fill('1D3FAE')
  await dialog.getByRole('radio', { name: 'Primario' }).click()
  await dialog.getByLabel('Pantone, CMYK o note').fill('Pantone 286 C')
  await dialog.getByRole('checkbox', { name: /Usa come colore dell’azienda/ }).click()
  await dialog.getByRole('button', { name: 'Aggiungi colore' }).click()

  await expect(colors.getByText('Blu notte')).toBeVisible()
  await expect(colors.getByText('29, 63, 174')).toBeVisible()
  await expect(colors.getByText('Pantone 286 C')).toBeVisible()
  await expect(colors.getByText(/· AAA/)).toBeVisible()
  await expect(colors.getByText('App', { exact: true })).toBeVisible()

  await colors.getByRole('button', { name: 'Copia #1D3FAE (Blu notte)' }).click()
  await expect(page.getByText('Copiato: #1D3FAE')).toBeVisible()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('#1D3FAE')

  await page.getByRole('button', { name: 'Copia variabili CSS' }).click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('--color-blu-notte: #1d3fae;')

  // il colore dell'azienda nell'app ora è quello del brand
  await page.goto('/aziende')
  const card = page.locator('article').filter({ hasText: 'Studio Test' }).first()
  await expect(card).toHaveAttribute('style', /--c: #1d3fae/)
})

test('font: dal file caricato con nome e stile letti dal nome del file', async ({ page }) => {
  await openSetup(page)
  const fonts = section(page, 'Font')
  await fonts.locator('input[type=file]').first().setInputFiles({
    name: 'jetbrains-mono-latin-400-normal.woff2',
    mimeType: 'font/woff2',
    buffer: fontFile,
  })

  await expect(fonts.getByRole('heading', { name: 'Jetbrains Mono' })).toBeVisible()
  await expect(fonts.getByText('Anteprima dal file caricato')).toBeVisible()
  await expect(fonts.getByText('Titoli', { exact: true })).toBeVisible()
  const family = await fonts
    .getByText(/^Quel vituperabile/)
    .evaluate((el) => getComputedStyle(el.parentElement!).fontFamily)
  expect(family).toMatch(/^"?brand-/)
})

test('tono e documenti: linee guida e link', async ({ page }) => {
  await openSetup(page)
  await section(page, 'Tono e linee guida').getByRole('button', { name: 'Compila' }).click()
  const guide = page.getByRole('dialog')
  await guide.getByLabel('Payoff').fill('Fatto bene, fatto ora')
  await guide.getByLabel('Hashtag').fill('studiotest, #lavoro')
  await guide.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('“Fatto bene, fatto ora”')).toBeVisible()
  await expect(page.getByText('#studiotest', { exact: true })).toBeVisible()

  const docs = section(page, 'Documenti e risorse')
  await docs.getByRole('button', { name: 'Link', exact: true }).click()
  const link = page.getByRole('dialog', { name: 'Nuovo link' })
  await link.getByLabel('Link').fill('figma.com/file/abc')
  await link.getByLabel('Nome').fill('File Figma')
  await link.getByRole('button', { name: 'Aggiungi link' }).click()
  await expect(docs.getByRole('link', { name: 'File Figma' })).toHaveAttribute(
    'href',
    'https://figma.com/file/abc',
  )

  await docs
    .locator('input[type=file]')
    .first()
    .setInputFiles({
      name: 'Brand book.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4 test'),
    })
  await expect(docs.getByRole('button', { name: 'Brand book', exact: true })).toBeVisible()
  const download = page.waitForEvent('download')
  await docs.getByRole('button', { name: 'Scarica Brand book' }).click()
  expect((await download).suggestedFilename()).toBe('Brand book.pdf')
})
