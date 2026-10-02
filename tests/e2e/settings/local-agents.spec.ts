import { expect, test, type Page } from '@playwright/test'

function agentRow(page: Page, name: string) {
  return page.getByRole('group', { name, exact: true })
}

async function setup(page: Page, initialCommands: string[]) {
  const commands = new Set(initialCommands)
  const installs: Array<{ id: string; package: string }> = []
  let failInstall = false
  let scans = 0
  await page.route('**/__test/local-agents/lookup', (route) => {
    scans++
    return route.fulfill({
      json: {
        searchPath: '/test/bin',
        executables: Object.fromEntries(
          [...commands].map((command) => [command, `/test/bin/${command}`])
        )
      }
    })
  })
  await page.route('**/__test/local-agents/install', (route) => {
    const request = route.request().postDataJSON() as { id: string; package: string }
    installs.push(request)
    if (failInstall) return route.fulfill({ status: 500 })
    const executable = request.id === 'claude-code' ? 'claude-agent-acp' : 'codex-acp'
    commands.add(request.id === 'canvas' ? 'openpencil-mcp-http' : executable)
    return route.fulfill({ status: 200 })
  })
  await page.goto('/tests/helpers/agents/fixture.html')
  await expect(agentRow(page, 'Kiro CLI')).toBeVisible()
  return {
    commands,
    installs,
    scans: () => scans,
    failInstall: (value: boolean) => {
      failInstall = value
    }
  }
}

test('detects local CLIs and installs an adapter only when requested', async ({ page }) => {
  const fixture = await setup(page, ['claude', 'codex', 'kiro-cli', 'npm', 'openpencil-mcp-http'])
  const claude = agentRow(page, 'Claude Code')
  await expect(claude.getByText('CLI detected · chat adapter required')).toBeVisible()
  await expect(agentRow(page, 'Kiro CLI').getByText('Installed', { exact: true })).toBeVisible()
  await expect(
    agentRow(page, 'Gemini CLI').getByText('Not installed', { exact: true })
  ).toBeVisible()
  expect(fixture.installs).toEqual([])
  await expect(page.getByRole('region', { name: 'Local agents', exact: true })).toHaveScreenshot(
    'local-agents.png'
  )

  await claude.getByRole('button', { name: 'Install adapter', exact: true }).click()
  await expect(claude.getByRole('button', { name: 'Use for chat' })).toBeVisible()
  expect(fixture.installs).toEqual([
    { id: 'claude-code', package: '@agentclientprotocol/claude-agent-acp' }
  ])
  expect(fixture.scans()).toBeGreaterThan(1)

  const count = await page.getByTestId('settings-model-list').locator('[data-model-id]').count()
  await claude.getByRole('button', { name: 'Use for chat' }).click()
  await expect(page.getByTestId('chat-profile-selector')).toContainText('Claude Code')
  await expect(page.getByTestId('settings-model-list').locator('[data-model-id]')).toHaveCount(
    count + 1
  )
  await expect(claude.getByRole('button', { name: 'Selected for chat' })).toBeDisabled()
  await expect(page.getByTestId('provider-settings-api-key')).toHaveCount(0)

  await page.getByTestId('chat-profile-selector').click()
  await page.getByRole('option', { name: 'Kiro CLI', exact: true }).click()
  await expect(page.getByTestId('chat-profile-selector')).toContainText('Kiro CLI')
  await claude.getByRole('button', { name: 'Use for chat' }).click()
  await expect(page.getByTestId('settings-model-list').locator('[data-model-id]')).toHaveCount(
    count + 2
  )
})

test('failed setup can be retried and refresh notices an uninstalled CLI', async ({ page }) => {
  const fixture = await setup(page, ['codex', 'npm', 'openpencil-mcp-http'])
  fixture.failInstall(true)
  const codex = agentRow(page, 'Codex')
  await codex.getByRole('button', { name: 'Install adapter' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not install the adapter')
  await expect(codex.getByRole('button', { name: 'Install adapter' })).toBeEnabled()
  fixture.failInstall(false)
  await codex.getByRole('button', { name: 'Install adapter' }).click()
  await expect(codex.getByRole('button', { name: 'Use for chat' })).toBeVisible()
  expect(fixture.installs).toHaveLength(2)

  fixture.commands.delete('codex')
  fixture.commands.delete('codex-acp')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(codex.getByText('Not installed', { exact: true })).toBeVisible()
  await expect(codex.getByRole('button', { name: 'Use for chat' })).toHaveCount(0)
})

test('native ACP agents are usable when npm is absent', async ({ page }) => {
  const fixture = await setup(page, ['kiro-cli', 'claude', 'openpencil-mcp-http'])
  await expect(
    agentRow(page, 'Claude Code').getByRole('button', { name: 'Install adapter' })
  ).toBeDisabled()
  await agentRow(page, 'Kiro CLI').getByRole('button', { name: 'Use for chat' }).click()
  await expect(page.getByTestId('chat-profile-selector')).toContainText('Kiro CLI')
  expect(fixture.installs).toEqual([])
})

test('sets up the missing canvas companion for Kiro and reconnects without restarting the app', async ({
  page
}) => {
  let restarts = 0
  await page.route('**/__test/local-agents/restart', (route) => {
    restarts++
    return route.fulfill({ status: 200 })
  })
  const fixture = await setup(page, ['kiro-cli', 'npm'])
  const setupButton = page.getByRole('button', { name: 'Set up canvas connection', exact: true })
  await expect(setupButton).toBeVisible()
  expect(fixture.installs).toEqual([])
  fixture.failInstall(true)
  await setupButton.click()
  await expect(page.getByRole('alert')).toContainText('Could not install the canvas companion')
  expect(restarts).toBe(0)
  fixture.failInstall(false)
  await setupButton.click()
  await expect(setupButton).toHaveCount(0)
  expect(fixture.installs.at(-1)).toEqual({ id: 'canvas', package: '@open-pencil/mcp@0.15.1' })
  expect(restarts).toBe(1)
  await agentRow(page, 'Kiro CLI').getByRole('button', { name: 'Use for chat' }).click()
  await expect(page.getByTestId('chat-profile-selector')).toContainText('Kiro CLI')
})
