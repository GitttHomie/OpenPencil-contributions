import { test, expect } from '#tests/helpers/chat/fixture'
import { installKiroPermissionTransport } from '#tests/helpers/chat/kiro'

test('Kiro streams grouped reasoning and offers scoped canvas approval', async ({
  configuredChat: chat,
  page
}, testInfo) => {
  await installKiroPermissionTransport(page)
  await chat.submit('Inspect the canvas')
  const permission = page.getByTestId('acp-permission-dialog')
  await expect(permission).toBeVisible()
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
  await expect(chat.assistantMessage()).toContainText('Kiro extensions')
  await expect(chat.assistantMessage()).toContainText('This status applies to this tool call.')
  await expect(permission).toBeHidden()
  await expect(page.getByTestId('chat-run-status')).toHaveText('Run finished')
  await page.screenshot({ path: testInfo.outputPath('kiro-chat.png') })
})
