import { expect, test } from '#tests/helpers/chat/fixture'

test('assistant responds', async ({ configuredChat: chat }) => {
  await chat.submit('Hello there')
  await expect(chat.assistantMessage()).toContainText('mock response')
})

test('reasoning and response copy actions render', async ({ configuredChat: chat }) => {
  await chat.submit('Show reasoning')

  const reasoning = chat.assistantMessage().getByRole('button', { name: 'Reasoning' })
  await expect(reasoning).toHaveAttribute('data-state', 'closed')
  await reasoning.click()
  await expect(reasoning).toHaveAttribute('data-state', 'open')
  await expect(
    chat.assistantMessage().locator('[data-slot="chat-reasoning-content"]')
  ).toBeVisible()
  await expect(chat.assistantMessage().getByRole('button', { name: 'Copy response' })).toBeVisible()
})

test('multipart assistant messages expose one copy action', async ({ configuredChat: chat }) => {
  await chat.submit('Show multiple parts')
  await expect(chat.assistantMessage()).toContainText('Second')
  await expect(chat.assistantMessage().getByRole('button', { name: 'Copy response' })).toHaveCount(
    1
  )
})

test('tool calls render their result', async ({ configuredChat: chat }) => {
  await chat.submit('Create a frame')
  await expect(chat.assistantMessage().getByText('Create Shape')).toBeVisible()
  await expect(chat.assistantMessage().getByText('Done')).toBeVisible()
  await expect(chat.assistantMessage().getByText('Created a frame', { exact: false })).toBeVisible()
})

test('authentication errors explain the cause and link to Settings', async ({
  configuredChat: chat
}) => {
  await chat.submit('Trigger expired key error')

  const toast = chat.page.locator('[data-slot="toast"]').filter({
    hasText: 'Your provider API key is invalid or expired. Replace it in Settings.'
  })
  await expect(toast).toBeVisible()
  await expect(chat.page.locator('[data-slot="toast"]')).toHaveCount(1)
  await toast.getByRole('button', { name: 'Open settings' }).click()
  await expect(chat.page.getByTestId('app-settings-dialog')).toBeVisible()
})

test('transport errors show a safe localized toast', async ({ configuredChat: chat }) => {
  await chat.submit('Trigger missing agent error')
  await expect(
    chat.page.locator('[data-slot="toast"]').filter({
      hasText: 'The model request failed. Check the provider settings and try again.'
    })
  ).toBeVisible()
})

test('missing canvas setup has its own error and opens local agent settings', async ({
  configuredChat: chat
}) => {
  await chat.submit('Trigger missing canvas error')
  const toast = chat.page.locator('[data-slot="toast"]').filter({
    hasText: 'The local agent cannot connect to the canvas.'
  })
  await expect(toast).toBeVisible()
  await expect(toast).not.toContainText('The model request failed.')
  await toast.getByRole('button', { name: 'Open settings' }).click()
  await expect(chat.page.getByTestId('settings-ai-panel')).toBeVisible()
  await expect(chat.page.getByTestId('settings-add-model')).toBeVisible()
})

test('Codex MCP successes show Done and real errors remain inspectable', async ({
  configuredChat: chat
}) => {
  await chat.submit('Show Codex tool results')
  const message = chat.assistantMessage()
  const success = message.getByRole('button', { name: 'Get Selection Done', exact: true })
  await expect(success).toBeVisible()
  await success.click()
  await expect(message.locator('pre').filter({ hasText: 'selection' })).toBeVisible()
  const failure = message.getByRole('button', { name: 'Get Node Error', exact: true })
  await expect(failure).toBeVisible()
  await failure.click()
  await expect(message.locator('pre').filter({ hasText: 'Node not found' })).toBeVisible()
})
