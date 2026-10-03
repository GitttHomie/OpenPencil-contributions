import { expect, test, type Page } from '@playwright/test'

function agentRow(page: Page, name: string) {
  return page.getByRole('group', { name, exact: true })
}

async function setup(page: Page, initialCommands: string[]) {
  const commands = new Set(initialCommands)
  const installs: Array<{ id: string; package: string }> = []
  let failInstall = false
  let scans = 0
  const modelLookups: string[] = []
  await page.route('**/__test/local-agents/models/*', (route) => {
    modelLookups.push(route.request().url().split('/').at(-1) ?? '')
    return route.fulfill({
      json: {
        selector: { kind: 'config', id: 'model' },
        currentModelId: 'strong-model',
        models: [
          { id: 'quick-model', name: 'Quick model' },
          { id: 'strong-model', name: 'Strong model' }
        ]
      }
    })
  })
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
  await expect(page.getByTestId('settings-model-list')).toBeVisible()
  return {
    commands,
    installs,
    modelLookups,
    scans: () => scans,
    failInstall: (value: boolean) => {
      failInstall = value
    }
  }
}

async function addCLIModel(page: Page, name: string) {
  await page.getByTestId('settings-add-model').click()
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name, exact: true }).click()
  await expect(agentRow(page, name)).toBeVisible()
}

test('adds a CLI through the same model editor and installs its adapter only on request', async ({
  page
}) => {
  const fixture = await setup(page, ['claude', 'codex', 'kiro-cli', 'npm', 'openpencil-mcp-http'])
  const count = await page.getByTestId('settings-model-list').locator('[data-model-id]').count()
  await expect(page.getByRole('region', { name: 'Local agents', exact: true })).toHaveCount(0)
  await page.getByTestId('chat-profile-selector').click()
  await expect(page.getByRole('option', { name: 'Kiro CLI', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await addCLIModel(page, 'Claude Code')
  const claude = agentRow(page, 'Claude Code')
  await expect(claude.getByText('CLI detected · chat adapter required')).toBeVisible()
  expect(fixture.installs).toEqual([])
  await claude.getByRole('button', { name: 'Install adapter', exact: true }).click()
  await expect(claude.getByText('Installed', { exact: true })).toBeVisible()
  expect(fixture.installs).toEqual([
    { id: 'claude-code', package: '@agentclientprotocol/claude-agent-acp' }
  ])
  expect(fixture.scans()).toBeGreaterThan(1)
  await expect(page.getByTestId('provider-settings-api-key')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  await expect(page.getByTestId('settings-model-list').locator('[data-model-id]')).toHaveCount(
    count + 1
  )
  await page.getByTestId('chat-profile-selector').click()
  await page.getByRole('option', { name: 'Claude Code' }).click()
  await expect(page.getByTestId('chat-profile-selector')).toContainText('Claude Code')
  await page.getByTestId('settings-model-assignment-review').click()
  await page.getByRole('option', { name: 'Claude Code', exact: true }).click()
  await page.reload()
  await expect(page.getByTestId('settings-model-assignment-review')).toContainText('Claude Code')
  await expect(page.getByTestId('chat-profile-selector')).toContainText('Claude Code')
})

test('saves different underlying CLI models for Design and Review and shows them in chat', async ({
  page
}, testInfo) => {
  const fixture = await setup(page, ['codex', 'codex-acp', 'openpencil-mcp-http'])
  await addCLIModel(page, 'Codex')
  await page.getByRole('button', { name: 'Model ID', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('cli-model-picker.png') })
  await page.getByRole('option', { name: /^Quick model/ }).click()
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  await addCLIModel(page, 'Codex')
  await page.getByRole('button', { name: 'Model ID', exact: true }).click()
  await page.getByRole('option', { name: /^Strong model/ }).click()
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  await page.getByTestId('settings-model-assignment-design').click()
  await page.getByRole('option', { name: 'Codex · Strong model', exact: true }).click()
  await page.getByTestId('settings-model-assignment-review').click()
  await page.getByRole('option', { name: 'Codex · Quick model', exact: true }).click()
  await page.reload()
  await expect(page.getByTestId('settings-model-assignment-design')).toContainText('Strong model')
  await expect(page.getByTestId('settings-model-assignment-review')).toContainText('Quick model')
  await page.getByTestId('chat-profile-selector').click()
  await page.getByRole('option', { name: /Codex · Quick model/ }).click()
  await expect(page.getByTestId('chat-profile-selector')).toContainText('Quick model')
  await page.getByRole('button', { name: /Codex · Strong model/ }).click()
  await expect(page.getByRole('button', { name: 'Model ID', exact: true })).toContainText(
    'Strong model'
  )
  expect(fixture.modelLookups).toContain('codex')
  expect(fixture.installs).toEqual([])
})

test('failed setup can be retried and refresh notices an uninstalled CLI', async ({ page }) => {
  const fixture = await setup(page, ['codex', 'npm', 'openpencil-mcp-http'])
  await addCLIModel(page, 'Codex')
  const codex = agentRow(page, 'Codex')
  fixture.failInstall(true)
  await codex.getByRole('button', { name: 'Install adapter' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not install the adapter')
  fixture.failInstall(false)
  await codex.getByRole('button', { name: 'Install adapter' }).click()
  await expect(codex.getByText('Installed', { exact: true })).toBeVisible()
  expect(fixture.installs).toHaveLength(2)
  fixture.commands.delete('codex')
  fixture.commands.delete('codex-acp')
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(codex.getByText('Not installed', { exact: true })).toBeVisible()
})

test('failed model discovery preserves the saved choice and can be retried', async ({ page }) => {
  await setup(page, ['codex', 'codex-acp', 'openpencil-mcp-http'])
  await addCLIModel(page, 'Codex')
  await page.getByRole('button', { name: 'Model ID', exact: true }).click()
  await page.getByRole('option', { name: /^Quick model/ }).click()
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  await page.route('**/__test/local-agents/models/*', (route) => route.fulfill({ status: 500 }))
  await page.getByRole('button', { name: /Codex · Quick model/ }).click()
  await expect(page.getByRole('alert')).toContainText('Could not load')
  await expect(page.getByRole('button', { name: 'Model ID', exact: true })).toContainText(
    'quick-model'
  )
  await page.route('**/__test/local-agents/models/*', (route) =>
    route.fulfill({
      json: {
        selector: { kind: 'config', id: 'model' },
        currentModelId: 'quick-model',
        models: [{ id: 'quick-model', name: 'Quick model' }]
      }
    })
  )
  await page.getByRole('button', { name: 'Refresh models', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Model ID', exact: true })).toContainText(
    'Quick model'
  )
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('native ACP profiles need no npm and cancelling creates no model', async ({ page }) => {
  const fixture = await setup(page, ['kiro-cli', 'claude', 'openpencil-mcp-http'])
  const count = await page.getByTestId('settings-model-list').locator('[data-model-id]').count()
  await addCLIModel(page, 'Claude Code')
  await expect(
    agentRow(page, 'Claude Code').getByRole('button', { name: 'Install adapter' })
  ).toBeDisabled()
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'Kiro CLI', exact: true }).click()
  await expect(agentRow(page, 'Kiro CLI').getByText('Installed', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByTestId('settings-model-list').locator('[data-model-id]')).toHaveCount(
    count
  )
  expect(fixture.installs).toEqual([])
})

test('sets up the missing canvas companion inside a CLI model profile', async ({ page }) => {
  let restarts = 0
  await page.route('**/__test/local-agents/restart', (route) => {
    restarts++
    return route.fulfill({ status: 200 })
  })
  const fixture = await setup(page, ['kiro-cli', 'npm'])
  await addCLIModel(page, 'Kiro CLI')
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
})
