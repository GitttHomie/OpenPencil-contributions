import { test, expect } from '#tests/helpers/chat/fixture'
import { finishReasoning, installReasoningTransport } from '#tests/helpers/chat/reasoning'

test('run status stays working during reasoning and persistently confirms the whole run finished', async ({
  configuredChat: chat,
  page
}, testInfo) => {
  const status = page.getByTestId('chat-run-status')
  await expect(status).toHaveCount(0)
  await installReasoningTransport(page)
  await chat.submit('Inspect the layout')
  await expect(status).toHaveText('Agent is working…')
  await finishReasoning(page)
  await expect(status).toHaveText('Run finished')
  await expect(page.getByTestId('chat-stop-button')).toBeHidden()
  await chat.input.fill('A follow-up draft')
  await expect(status).toHaveText('Run finished')
  await page.screenshot({ path: testInfo.outputPath('run-finished.png') })
})

test('stopping a run is distinct from completion', async ({ configuredChat: chat, page }) => {
  await installReasoningTransport(page)
  await chat.submit('Inspect the layout')
  await expect(page.getByTestId('chat-run-status')).toHaveAttribute('data-state', 'working')
  await page.getByTestId('chat-stop-button').click()
  await expect(page.getByTestId('chat-run-status')).toHaveText('Run stopped')
})

test('provider errors remain visible as failed runs', async ({ configuredChat: chat, page }) => {
  await chat.submit('missing agent')
  await expect(page.getByTestId('chat-run-status')).toHaveText('Run failed')
})

test('an unconfirmed stream ending shows interrupted, never finished', async ({
  configuredChat: chat,
  page
}) => {
  await installReasoningTransport(page, null)
  await chat.submit('Inspect the layout')
  await expect(page.getByTestId('chat-run-status')).toHaveAttribute('data-state', 'working')
  await finishReasoning(page)
  await expect(page.getByTestId('chat-run-status')).toHaveAttribute('data-state', 'interrupted')
})

test('a provider limit pauses the run and offers continuation', async ({
  configuredChat: chat,
  page
}) => {
  await installReasoningTransport(page, 'length')
  await chat.submit('Inspect the layout')
  await expect(page.getByTestId('chat-run-status')).toHaveAttribute('data-state', 'working')
  await finishReasoning(page)
  await expect(page.getByTestId('chat-run-status')).toHaveAttribute('data-state', 'limited')
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible()
})
