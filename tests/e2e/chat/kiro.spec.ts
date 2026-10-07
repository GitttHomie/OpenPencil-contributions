import { test, expect } from '#tests/helpers/chat/fixture'
import {
  installKiroPermissionTransport,
  installQueuedPermissionTransport
} from '#tests/helpers/chat/kiro'

for (const [action, result] of [
  ['Allow', 'accept'],
  ['Deny', 'reject'],
  ['Cancel', 'cancelled']
]) {
  test(`queued approval remains visible after ${action}`, async ({
    configuredChat: chat,
    page
  }) => {
    await installQueuedPermissionTransport(page)
    await chat.submit('Inspect the canvas')
    const permission = page.getByTestId('acp-permission-dialog')
    await expect(permission).toContainText('First request')
    await expect(permission.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused()
    await permission.getByRole('button', { name: action, exact: true }).click()
    await expect(permission).toBeVisible()
    await expect(permission).toContainText('@open-pencil/get_design_guidance')
    await expect(page.getByTestId('chat-run-status')).toHaveText('Waiting for your approval')
    await permission.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(permission).toBeHidden()
    await expect(chat.assistantMessage()).toContainText(`${result}, cancelled`)
    await expect(page.getByTestId('chat-run-status')).toHaveText('Run finished')
  })
}

test('Kiro streams grouped reasoning and offers scoped canvas approval', async ({
  configuredChat: chat,
  page
}, testInfo) => {
  await page.clock.install()
  await installKiroPermissionTransport(page)
  await chat.submit('Inspect the canvas')
  const permission = page.getByTestId('acp-permission-dialog')
  await expect(permission).toBeVisible()
  await page.clock.fastForward(65_000)
  await expect(permission).toContainText('@open-pencil/get_selection')
  await page.locator('[data-slot="alert-dialog-overlay"]').click({ position: { x: 5, y: 5 } })
  await page.keyboard.press('Escape')
  await expect(permission).toBeVisible()
  await expect(permission).toContainText('@open-pencil/get_selection')
  await expect(page.getByTestId('chat-run-status')).toHaveText('Waiting for your approval')
  await expect(page.locator('[data-slot="chat-reasoning-trigger"]')).toHaveCount(1)
  await page.screenshot({ path: testInfo.outputPath('canvas-permission.png') })
  await permission
    .getByRole('button', { name: 'Allow OpenPencil canvas tools for this chat', exact: true })
    .click()
  await expect(permission).toContainText('Run shell command')
  await expect(
    permission.getByRole('button', {
      name: 'Allow OpenPencil canvas tools for this chat',
      exact: true
    })
  ).toHaveCount(0)
  await permission.getByRole('button', { name: 'Deny', exact: true }).click()
  await expect(chat.assistantMessage()).toContainText('Permission flow complete.')
  await chat
    .assistantMessage()
    .getByRole('button', { name: 'Earlier steps: 3', exact: true })
    .click()
  await expect(chat.assistantMessage()).toContainText('Kiro extensions')
  await expect(chat.assistantMessage()).toContainText('This status applies to this tool call.')
  await expect(permission).toBeHidden()
  await expect(page.getByTestId('chat-run-status')).toHaveText('Run finished')
  await page.screenshot({ path: testInfo.outputPath('kiro-chat.png') })
})
