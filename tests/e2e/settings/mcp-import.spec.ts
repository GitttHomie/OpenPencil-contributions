import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'

test('imports a local MCP definition, keeps environment out of preferences, and edits it without losing arguments', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-mcp').click()
  await page.getByRole('button', { name: 'Import MCP configuration', exact: true }).click()
  const json = page.getByRole('textbox', { name: 'MCP configuration JSON' })
  await json.fill(
    JSON.stringify({
      mcpServers: {
        Example: {
          command: '/tmp/Example MCP/server',
          args: ['--workspace', '/tmp/My project'],
          env: { EXAMPLE_TOKEN: 'test-only-private-environment' },
          disabled: false,
          autoApprove: []
        }
      }
    })
  )
  await page.getByRole('button', { name: 'Import MCP configuration', exact: true }).last().click()
  await expect(json).toHaveValue('')
  await page.getByRole('button', { name: /^Example / }).click()
  await expect(page.getByRole('textbox', { name: 'Executable', exact: true })).toHaveValue(
    '/tmp/Example MCP/server'
  )
  await expect(page.getByRole('textbox', { name: 'Arguments (one per line)' })).toHaveValue(
    '--workspace\n/tmp/My project'
  )
  await expect(page.getByRole('textbox', { name: 'Environment (JSON)' })).toHaveValue('')
  await expect(
    page.getByRole('textbox', { name: 'Auto-approved API tools (one exact name per line)' })
  ).toHaveValue('')
  await expect(page.getByRole('switch', { name: 'Available in chats' })).toBeChecked()
  const preferences = JSON.stringify((await page.context().storageState()).origins)
  expect(preferences).not.toContain('test-only-private-environment')
  expect(preferences).not.toContain('EXAMPLE_TOKEN')
  await page.screenshot({ path: test.info().outputPath('local-connection.png') })
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Example / })).toBeVisible()
  await page.getByTestId('app-settings-done').click()
  await page.reload()
  await canvas.waitForInit()
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-mcp').click()
  await page.getByRole('button', { name: /^Example / }).click()
  await expect(page.getByRole('textbox', { name: 'Executable', exact: true })).toHaveValue(
    '/tmp/Example MCP/server'
  )
})
