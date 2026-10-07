import { expect, test, type Page } from '@playwright/test'

function agentRow(page: Page, name: string) {
  return page.getByRole('group', { name, exact: true })
}

async function setup(
  page: Page,
  initialCommands: string[],
  thinking = false,
  bridgeVersion = '0.15.1'
) {
  const commands = new Set(initialCommands)
  let installedBridgeVersion = bridgeVersion
  const installs: Array<{ id: string; package: string }> = []
  let failInstall = false
  let scans = 0
  const modelLookups: string[] = []
  await page.route('**/__test/local-agents/models/*', (route) => {
    const url = new URL(route.request().url())
    modelLookups.push(url.pathname.split('/').at(-1) ?? '')
    return route.fulfill({
      json: {
        selector: { kind: 'config', id: 'model' },
        currentModelId: 'strong-model',
        ...(thinking
          ? {
              thinking: {
                id: 'effort',
                name: 'Thinking level',
                currentValue: 'balanced',
                options: [
                  { value: 'balanced', name: 'Balanced' },
                  ...(url.searchParams.get('model') !== 'quick-model'
                    ? [{ value: 'deep', name: 'Thorough' }]
                    : [])
                ]
              }
            }
          : {}),
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
        versions: commands.has('openpencil-mcp-http')
          ? { '@open-pencil/mcp': installedBridgeVersion }
          : {},
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
    if (request.id === 'canvas') installedBridgeVersion = '0.15.1'
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

test('CLI thinking choices follow the selected model and survive saving and reopening', async ({
  page
}) => {
  await setup(page, ['codex', 'codex-acp', 'openpencil-mcp-http'], true)
  await addCLIModel(page, 'Codex')
  const thinking = page.getByRole('combobox', { name: 'Thinking level', exact: true })
  await thinking.click()
  await page.getByRole('option', { name: 'Thorough', exact: true }).click()
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Codex/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /^Codex/ }).click()
  await expect(thinking).toContainText('Thorough')
  await page.getByRole('button', { name: 'Model ID', exact: true }).click()
  await page.getByRole('option', { name: /^Quick model/ }).click()
  await expect(thinking).toBeEnabled()
  await expect(thinking).toContainText('Default')
  await thinking.click()
  await expect(page.getByRole('option', { name: 'Thorough', exact: true })).toHaveCount(0)
  await page.getByRole('option', { name: 'Balanced', exact: true }).click()
})

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
  await expect(page.getByTestId('chat-thinking-selector')).toHaveCount(0)
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
  await expect.poll(() => restarts).toBe(1)
})

test('CLI model verification is explicit, reports unavailable models, and resets after changes', async ({
  page
}) => {
  let succeeds = false
  const verifications: unknown[] = []
  await page.route('**/__test/local-agents/verify', (route) => {
    verifications.push(route.request().postDataJSON())
    return route.fulfill({
      json: succeeds ? { ok: true } : { ok: false, reason: 'model-not-found' }
    })
  })
  await setup(page, ['codex', 'codex-acp', 'openpencil-mcp-http'])
  await addCLIModel(page, 'Codex')
  await page.getByRole('button', { name: 'Model ID', exact: true }).click()
  await page.getByRole('option', { name: /^Quick model/ }).click()
  expect(verifications).toEqual([])
  await page.getByTestId('provider-test-connection').click()
  const result = page.getByTestId('provider-test-connection-result')
  await expect(result).toHaveAttribute('data-tone', 'error')
  expect(verifications[0]).toMatchObject({ providerID: 'acp:codex', modelID: 'quick-model' })
  succeeds = true
  await page.getByTestId('provider-test-connection').click()
  await expect(result).toHaveAttribute('data-tone', 'success')
  await page.getByRole('button', { name: 'OpenPencil CLI overrides', exact: true }).click()
  await page.getByRole('textbox', { name: 'Codex provider ID', exact: true }).fill('bedrock')
  await page
    .getByRole('textbox', { name: 'Base URL', exact: true })
    .fill('https://example.test/openai/v1')
  await expect(result).toHaveCount(0)
  await page.getByTestId('provider-test-connection').click()
  await expect(result).toHaveAttribute('data-tone', 'success')
  expect(verifications.at(-1)).toMatchObject({
    acpLaunch: { codexProvider: 'bedrock', codexBaseURL: 'https://example.test/openai/v1' }
  })
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  await expect(page.getByRole('button', { name: /^Codex/ })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: /^Codex/ }).click()
  await expect(result).toHaveCount(0)
  await page.getByRole('button', { name: 'OpenPencil CLI overrides', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Codex provider ID', exact: true })).toHaveValue(
    'bedrock'
  )
  await expect(page.getByRole('textbox', { name: 'Base URL', exact: true })).toHaveValue(
    'https://example.test/openai/v1'
  )
})

test('an incompatible companion keeps an update action until a matching version is installed', async ({
  page
}) => {
  let restarts = 0
  await page.route('**/__test/local-agents/restart', (route) => {
    restarts++
    return route.fulfill({ status: 200 })
  })
  await setup(page, ['codex', 'codex-acp', 'openpencil-mcp-http', 'npm'], false, '0.14.0')
  await addCLIModel(page, 'Codex')
  const update = page.getByRole('button', { name: 'Update MCP server', exact: true })
  await expect(update).toBeVisible()
  await update.click()
  await expect.poll(() => restarts).toBe(1)
  await expect(update).toHaveCount(0)
})

test('adapter launch fields follow provider selection and keep region values user-controlled', async ({
  page
}) => {
  await setup(page, [
    'codex',
    'codex-acp',
    'claude',
    'claude-agent-acp',
    'kiro-cli',
    'openpencil-mcp-http'
  ])
  await addCLIModel(page, 'Codex')
  const overrides = page.getByRole('button', { name: 'OpenPencil CLI overrides', exact: true })
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Regional CLI')
  await overrides.click()
  await expect(page.getByRole('textbox', { name: 'Codex provider ID', exact: true })).toHaveValue(
    ''
  )
  await expect(page.getByRole('textbox', { name: 'Base URL', exact: true })).toHaveValue('')
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'Claude Code', exact: true }).click()
  const region = page.getByRole('textbox', { name: 'Bedrock AWS region', exact: true })
  await expect(region).toBeVisible()
  await expect(region).toHaveValue('')
  await expect(page.getByRole('textbox', { name: 'Codex provider ID', exact: true })).toHaveCount(0)
  await region.fill('eu-west-1')
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  const model = page.getByRole('button', { name: /^Regional CLI/ })
  await expect(model).toBeVisible()
  await page.reload()
  await model.click()
  await overrides.click()
  await expect(region).toHaveValue('eu-west-1')
  await page.getByTestId('settings-model-provider').click()
  await page.getByRole('option', { name: 'Kiro CLI', exact: true }).click()
  await expect(overrides).toBeVisible()
  await expect(region).toHaveCount(0)
})

test('team connection definitions validate, preview, persist and reset within the profile', async ({
  page
}) => {
  await setup(page, ['codex', 'codex-acp', 'openpencil-mcp-http'])
  await addCLIModel(page, 'Codex')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Team connection')
  await page.getByRole('button', { name: 'OpenPencil CLI overrides', exact: true }).click()
  await page
    .getByRole('button', { name: 'Integration configuration (advanced)', exact: true })
    .click()
  const configuration = page.getByRole('textbox', { name: 'Configuration JSON', exact: true })
  await configuration.fill('{ invalid')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(configuration).toHaveAttribute('aria-invalid', 'true')
  await expect(configuration).toBeFocused()
  const definition = {
    version: 1,
    agent: 'codex',
    fields: [
      {
        id: 'provider',
        label: 'Inference service',
        type: 'select',
        options: [
          { value: 'team-east', label: 'Team East' },
          { value: 'team-west', label: 'Team West' }
        ],
        target: { kind: 'config', flag: '-c', key: 'model_provider' }
      }
    ]
  }
  await configuration.fill(JSON.stringify({ ...definition, agent: 'claude-code' }))
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(configuration).toHaveAttribute('aria-invalid', 'true')
  await configuration.fill(JSON.stringify(definition))
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  const service = page.getByRole('combobox', { name: 'Inference service', exact: true })
  await expect(service).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Codex provider ID', exact: true })).toHaveCount(0)
  await service.click()
  await page.getByRole('option', { name: 'Team West', exact: true }).click()
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  const saved = page.getByRole('button', { name: /^Team connection/ })
  await expect(saved).toBeVisible()
  await page.reload()
  await saved.click()
  await page.getByRole('button', { name: 'OpenPencil CLI overrides', exact: true }).click()
  await expect(service).toContainText('Team West')
  await page
    .getByRole('button', { name: 'Integration configuration (advanced)', exact: true })
    .click()
  await page.getByRole('button', { name: 'Restore built-in configuration', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Codex provider ID', exact: true })).toHaveValue(
    ''
  )
  await expect(service).toHaveCount(0)
  await page.getByRole('button', { name: 'Cancel', exact: true }).last().click()
})

test('advertised session choices are saved, tested and can recover when the CLI removes them', async ({
  page
}) => {
  await setup(page, ['codex', 'codex-acp', 'openpencil-mcp-http'])
  let removed = false
  await page.route('**/__test/local-agents/models/*', (route) =>
    route.fulfill({
      json: {
        models: [{ id: 'strong-model', name: 'Strong model' }],
        currentModelId: 'strong-model',
        selector: { kind: 'config', id: 'model' },
        controls: removed
          ? []
          : [
              {
                id: 'speed',
                name: 'Response speed',
                currentValue: 'normal',
                options: [
                  { value: 'normal', name: 'Normal' },
                  { value: 'fast', name: 'Fast' }
                ]
              }
            ]
      }
    })
  )
  const verifications: unknown[] = []
  await page.route('**/__test/local-agents/verify', (route) => {
    verifications.push(route.request().postDataJSON())
    return route.fulfill({ json: { ok: true } })
  })
  await addCLIModel(page, 'Codex')
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Session choices')
  const speed = page.getByRole('combobox', { name: 'Response speed', exact: true })
  await speed.click()
  await page.getByRole('option', { name: 'Fast', exact: true }).click()
  await page.getByTestId('provider-test-connection').click()
  await expect(page.getByTestId('provider-test-connection-result')).toHaveAttribute(
    'data-tone',
    'success'
  )
  expect(verifications.at(-1)).toMatchObject({ acpOptions: { speed: 'fast' } })
  await page.getByRole('button', { name: 'Save model', exact: true }).click()
  const saved = page.getByRole('button', { name: /^Session choices/ })
  await expect(saved).toBeVisible()
  removed = true
  await page.reload()
  await saved.click()
  const stale = page.getByRole('combobox', { name: 'speed', exact: true })
  await expect(stale).toHaveAttribute('aria-invalid', 'true')
  await page.getByTestId('provider-test-connection').click()
  expect(verifications).toHaveLength(1)
  await expect(stale).toBeFocused()
  await stale.click()
  await page.getByRole('option', { name: 'Use CLI default', exact: true }).click()
  await expect(stale).toHaveCount(0)
  await page.getByTestId('provider-test-connection').click()
  await expect(page.getByTestId('provider-test-connection-result')).toHaveAttribute(
    'data-tone',
    'success'
  )
  expect(verifications.at(-1)).not.toHaveProperty('acpOptions')
})
