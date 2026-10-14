import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test.use({
  storageState: async ({ baseURL }, use) => {
    if (!baseURL) throw new Error('Browser test baseURL is required')
    const profile = {
      connectionId: 'cli',
      modelID: 'selected-model',
      customModelID: '',
      maxOutputTokens: 16384,
      thinkingLevel: 'default'
    }
    const value = JSON.stringify({
      version: 1,
      connections: [
        {
          id: 'cli',
          providerID: 'acp:codex',
          customBaseURL: '',
          customAPIType: 'responses',
          credentialProfileId: 'unused'
        }
      ],
      models: [
        {
          ...profile,
          id: 'model-ready',
          name: 'Image reader',
          capabilities: ['tools', 'vision'],
          imageSupport: 'verified'
        },
        { ...profile, id: 'model-unknown', name: 'Unverified CLI', capabilities: ['tools'] },
        {
          ...profile,
          id: 'model-no-images',
          name: 'Text only CLI',
          capabilities: ['tools'],
          imageSupport: 'unsupported'
        }
      ],
      assignments: { design: 'model-ready', review: null, fast: null, vision: null }
    })

    await use({
      cookies: [],
      origins: [
        {
          origin: new URL(baseURL).origin,
          localStorage: [{ name: 'open-pencil:ai-model-settings', value }]
        }
      ]
    })
  }
})

test('image understanding accepts a capable CLI and explains unavailable CLI profiles', async ({
  page
}, testInfo) => {
  await page.goto('/?test')
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-ai').click()
  const assignment = page.getByTestId('settings-model-assignment-vision')
  await assignment.click()
  await expect(page.getByRole('option', { name: /Unverified CLI/ })).toBeDisabled()
  await expect(page.getByRole('option', { name: /Text only CLI/ })).toBeDisabled()
  await page.getByRole('option', { name: 'Image reader', exact: true }).click()
  await expect(assignment).toContainText('Image reader')
  const automatic = page.getByRole('switch', { name: 'Check designs automatically', exact: true })
  await expect(automatic).not.toBeChecked()
  await automatic.click()
  await page.reload()
  await new CanvasHelper(page).waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-ai').click()
  await expect(assignment).toContainText('Image reader')
  await expect(automatic).toBeChecked()
  await automatic.scrollIntoViewIfNeeded()
  await testInfo.attach('design-check-settings', {
    body: await page.getByTestId('app-settings-dialog').screenshot(),
    contentType: 'image/png'
  })
})
