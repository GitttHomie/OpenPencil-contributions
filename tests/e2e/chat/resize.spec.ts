import { test, expect } from '#tests/helpers/chat/fixture'
import { trackResizeErrors } from '#tests/helpers/resize-errors'

test('opening dropdowns during dialog animations does not report resize loops', async ({
  configuredChat: chat,
  page
}) => {
  const errors = await trackResizeErrors(page)
  await page.getByTestId('provider-settings-trigger').click()
  await page.getByRole('combobox', { name: 'Reasoning display' }).click()
  await page.getByRole('option', { name: 'Expanded by default', exact: true }).click()
  await page.getByTestId('app-settings-done').click()
  await chat.submit('Show your reasoning')
  const trigger = page.locator('[data-slot="chat-reasoning-trigger"]')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await trigger.click()
  await expect
    .poll(() =>
      page
        .locator('[data-slot="chat-reasoning-content"]')
        .evaluate((element) => getComputedStyle(element).animationName)
    )
    .toBe('collapsible-up')
  await expect(page.locator('[data-slot="chat-reasoning-content"]')).toBeHidden()
  await page.reload()
  await chat.chatTab.click()
  await page.getByTestId('provider-settings-trigger').click()
  await page.getByRole('combobox', { name: 'Reasoning display' }).click()
  await page.getByRole('option', { name: 'Collapsed by default', exact: true }).click()
  await page.getByTestId('app-settings-done').click()
  expect(errors).toEqual([])
})
