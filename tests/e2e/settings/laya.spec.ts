import { expect, test } from '@playwright/test'

test('the local model downloads only on request and routing has its own opt-in', async ({
  page
}, testInfo) => {
  test.skip(process.env.VITE_EXPERIMENTAL_LAYA !== 'true', 'Requires the experimental build flag')
  let installed = false
  let loaded = false
  const calls: string[] = []
  await page.route('**/__test/laya/*', async (route) => {
    const command = new URL(route.request().url()).pathname.split('/').at(-1) ?? ''
    calls.push(command)
    if (command === 'laya_prepare') {
      installed = true
      loaded = true
    }
    if (command === 'laya_unload') loaded = false
    await route.fulfill({
      json: command === 'laya_status' ? { installed, loaded, busy: false } : null
    })
  })
  await page.goto('/tests/helpers/laya/fixture.html')
  const automatic = page.getByRole('switch', { name: 'Route new chats automatically' })
  await expect(automatic).toBeDisabled()
  await expect(automatic).not.toBeChecked()
  expect(calls).not.toContain('laya_prepare')
  await page.getByRole('button', { name: 'Download and load Laya' }).click()
  await expect(page.getByText('Laya is loaded locally')).toBeVisible()
  await expect(automatic).toBeEnabled()
  await expect(automatic).not.toBeChecked()
  await automatic.click()
  await expect(automatic).toBeChecked()
  await testInfo.attach('local-routing-settings', {
    body: await page.screenshot(),
    contentType: 'image/png'
  })
  await page.getByRole('button', { name: 'Unload Laya' }).click()
  await expect(automatic).not.toBeChecked()
  await expect(automatic).toBeDisabled()
  expect(calls).not.toContain('laya_predict')
})

test('the default build exposes neither Laya nor the Fast tasks assignment', async ({ page }) => {
  test.skip(process.env.VITE_EXPERIMENTAL_LAYA === 'true', 'Checks the default build')
  const calls: string[] = []
  await page.route('**/__test/laya/*', async (route) => {
    calls.push(route.request().url())
    await route.fulfill({ json: null })
  })
  await page.goto('/tests/helpers/laya/fixture.html')
  await expect(page.getByTestId('settings-model-assignment-design')).toBeVisible()
  await expect(page.getByText('Local routing (experimental)')).toHaveCount(0)
  await expect(page.getByTestId('settings-model-assignment-fast')).toHaveCount(0)
  expect(calls).toEqual([])
})

for (const assignment of ['Test fast model', 'Same as Design']) {
  test(`Fast tasks keeps ${assignment} after reloading settings`, async ({ page }) => {
    test.skip(process.env.VITE_EXPERIMENTAL_LAYA !== 'true', 'Requires the experimental build flag')
    await page.route('**/__test/laya/*', (route) =>
      route.fulfill({ json: { installed: true, loaded: true, busy: false } })
    )
    await page.goto('/tests/helpers/laya/fixture.html')
    if (assignment === 'Same as Design') {
      await page.getByRole('combobox', { name: 'Design agent', exact: true }).click()
      await page.getByRole('option', { name: 'Test fast model', exact: true }).click()
    }
    const fast = page.getByRole('combobox', { name: 'Fast tasks', exact: true })
    await fast.click()
    await page.getByRole('option', { name: 'None', exact: true }).click()
    await expect(fast).toHaveText('None')
    await fast.click()
    await page.getByRole('option', { name: assignment, exact: true }).click()
    await expect(fast).toHaveText(assignment)

    await page.reload()
    await expect(fast).toHaveText(assignment)
  })
}
