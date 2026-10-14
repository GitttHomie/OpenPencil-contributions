import type { Page } from '@playwright/test'

/** Preserve the fixture's embedded definitions while exercising the normal import prompt. */
export async function keepEmbeddedDefinitions(page: Page, opening: Promise<unknown>) {
  await page.getByRole('alertdialog').getByRole('button', { name: 'Keep everything' }).click()
  await opening
}
