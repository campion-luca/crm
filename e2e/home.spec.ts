import { expect, test } from '@playwright/test'
import { isoDay, seedLocal } from './helpers'

/** La Home sta tutta nello schermo: i moduli si dividono l'altezza e scorrono al loro interno. */
test('la Home non scorre e mostra tutti i moduli', async ({ page }) => {
  const tasks = Array.from({ length: 80 }, (_, i) => ({
    id: `00000000-0000-4000-a000-${String(i).padStart(12, '0')}`,
    title: `Lavoro ${i + 1}`,
    due: isoDay((i % 20) - 3),
  }))
  await seedLocal(page, tasks)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /^Buon/ })).toBeVisible()

  for (const [width, height] of [
    [1440, 900],
    [1440, 780],
    [1280, 720],
  ] as const) {
    await page.setViewportSize({ width, height })
    const overflow = await page.locator('#main').evaluate((el) => el.scrollHeight - el.clientHeight)
    expect(overflow, `${width}x${height}`).toBeLessThanOrEqual(0)
    for (const name of ['In scadenza', 'Completi', 'Aziende']) {
      await expect(page.getByRole('heading', { name, exact: true })).toBeInViewport()
    }
    await expect(page.locator('[data-date]').last()).toBeInViewport()
  }
})
