import { expect, test } from '#tests/helpers/chat/fixture'
import { documentSnapshot } from '#tests/helpers/chat/render-preview'
import { createReviewSelection } from '#tests/helpers/chat/review'

test('Review design uses its assigned model, returns findings, and leaves the canvas and chat model unchanged', async ({
  configuredChat: chat
}, testInfo) => {
  const page = chat.page
  const requests: Record<string, unknown>[] = []
  await page.route('https://openrouter.ai/api/v1/chat/completions', (route) => {
    requests.push(route.request().postDataJSON())
    return route.fulfill({
      json: {
        id: 'review-response',
        object: 'chat.completion',
        created: 1,
        model: 'review-test',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'Make the primary Checkout action more specific.'
            }
          }
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
      }
    })
  })
  await createReviewSelection(page)
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-ai').click()
  await expect(page.getByTestId('settings-model-assignment-fast')).toHaveCount(0)
  await page.getByTestId('settings-add-model').click()
  await page.getByLabel('Name', { exact: true }).fill('Separate reviewer')
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'OpenRouter', exact: true }).click()
  await page.getByLabel('Model ID', { exact: true }).click()
  await page.getByRole('option', { name: 'Custom model…', exact: true }).click()
  await page.getByLabel('Custom model ID', { exact: true }).fill('review-test')
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  await page.getByTestId('settings-model-assignment-review').click()
  await page.getByRole('option', { name: 'Separate reviewer', exact: true }).click()
  await page.getByTestId('app-settings-done').click()
  const before = await documentSnapshot(page)
  await page.getByRole('button', { name: 'Review design', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Review design', exact: true })
  await expect(dialog).toContainText('Separate reviewer')
  expect(requests).toHaveLength(0)
  await dialog.getByLabel('Focus (optional)').fill('Action clarity')
  await dialog.getByRole('button', { name: 'Review design', exact: true }).click()
  await expect(dialog).toContainText('Make the primary Checkout action more specific.')
  await expect(dialog).toContainText('Snapshot and screenshot reviewed')
  expect(requests).toHaveLength(1)
  expect(requests[0].model).toBe('review-test')
  expect(requests[0].tools ?? []).toEqual([])
  expect(JSON.stringify(requests[0].messages)).toContain('Checkout')
  expect(JSON.stringify(requests[0].messages)).toContain('Action clarity')
  expect(JSON.stringify(requests[0].messages)).toContain('image_url')
  expect(await documentSnapshot(page)).toEqual(before)
  await dialog.screenshot({ path: testInfo.outputPath('review-dialog.png') })
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(chat.profileTrigger).toContainText('Claude Sonnet')
  await expect(chat.assistantMessage()).toHaveCount(0)
})
