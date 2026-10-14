import { strict as assert } from 'node:assert'
import { readFileSync, renameSync } from 'node:fs'

import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import * as v from 'valibot'

import { invokeNative } from '#tests/helpers/tauri/invoke'

const HealthJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ status: v.string(), bundled: v.literal(true) })
)

const DiscoveryFileJSON = v.pipe(
  v.string(),
  v.parseJson(),
  v.object({ httpPort: v.number(), authToken: v.string() })
)

const NOT_INSTALLED = 'The bundled canvas helper is missing'

async function openMCPSettings(): Promise<void> {
  // The platform shortcut is how the existing native settings spec opens Settings.
  await browser.keys([process.platform === 'darwin' ? 'Meta' : 'Control', ','])
  await browser.waitUntil(
    () =>
      browser.execute(() =>
        Boolean(document.querySelector('[data-test-id="app-settings-dialog"]'))
      ),
    { timeout: 10_000, timeoutMsg: 'Settings did not open' }
  )
  await browser.execute(() => {
    const tab = document.querySelector<HTMLElement>('[data-test-id="settings-section-mcp"]')
    if (!tab) throw new Error('MCP settings tab is unavailable')
    tab.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
  })
  await browser.waitUntil(
    () =>
      browser.execute(() =>
        Boolean(document.querySelector('[data-test-id="settings-mcp-automation-panel"]'))
      ),
    { timeout: 10_000, timeoutMsg: 'MCP settings panel did not render' }
  )
}

function mcpStatus(): Promise<string | null> {
  return browser.execute(
    () =>
      document
        .querySelector<HTMLElement>(
          '[data-test-id="settings-mcp-automation-panel"] [role="status"]'
        )
        ?.textContent?.trim() ?? null
  )
}

function mcpAlert(): Promise<string | null> {
  return browser.execute(
    () =>
      document
        .querySelector<HTMLElement>(
          '[data-test-id="settings-mcp-failure"] [data-slot="alert-heading"]'
        )
        ?.textContent?.trim() ?? null
  )
}

/** Expand the failure disclosure and read the technical payload. */
function mcpFailureDetail(): Promise<string | null> {
  return browser.executeAsync((done) => {
    document
      .querySelector<HTMLElement>('[data-test-id="settings-mcp-failure-details"] button')
      ?.click()
    requestAnimationFrame(() => {
      done(
        document
          .querySelector<HTMLElement>('[data-test-id="settings-mcp-failure-detail"]')
          ?.textContent?.trim() ?? null
      )
    })
  })
}

/** Restart lives in the Local server section header, whether or not the server failed. */
function clickRestart(): Promise<void> {
  return browser.execute(() => {
    document.querySelector<HTMLButtonElement>('[data-test-id="settings-mcp-restart"]')?.click()
  })
}

async function waitForStatus(expected: string): Promise<void> {
  try {
    await browser.waitUntil(async () => (await mcpStatus()) === expected, { timeout: 30_000 })
  } catch {
    throw new Error(
      `MCP status was "${await mcpStatus()}" instead of "${expected}"; ` +
        `alert "${await mcpAlert()}"; detail "${await mcpFailureDetail()}"`
    )
  }
}

describe('native MCP server lifecycle', () => {
  // Native specs share one app process, which remembers the open Settings
  // section. Restore General before closing so the next spec finds it.
  afterEach(async () => {
    await browser.execute(() => {
      document
        .querySelector<HTMLElement>('[data-test-id="settings-section-general"]')
        ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }))
      document.querySelector<HTMLElement>('[data-test-id="app-settings-done"]')?.click()
    })
    await browser.waitUntil(
      () => browser.execute(() => !document.querySelector('[data-test-id="app-settings-dialog"]')),
      { timeout: 10_000, timeoutMsg: 'Settings did not close after the MCP spec' }
    )
  })

  it('starts its bundled helper and edits the native canvas through MCP', async () => {
    await browser.waitUntil(
      async () => browser.execute(() => Boolean(window.openPencil?.getStore?.())),
      { timeout: 30_000, timeoutMsg: 'OpenPencil editor did not initialize' }
    )
    await openMCPSettings()
    const lookup = await invokeNative<{ available: boolean; path: string | null }>('mcp_lookup')
    assert.ok(lookup.available && lookup.path, 'the desktop bundle must include its helper')
    await waitForStatus('Running')
    const discoveryPath = process.env.OPENPENCIL_MCP_DISCOVERY_PATH
    assert.ok(discoveryPath, 'discovery path missing from the wdio configuration')
    const discovery = v.parse(DiscoveryFileJSON, readFileSync(discoveryPath, 'utf8'))
    assert.ok(discovery.authToken, 'discovery file omitted the auth token')

    // The spawned server serves the app: real port, real token.
    const health = await fetch(`http://127.0.0.1:${discovery.httpPort}/health`, {
      headers: { authorization: `Bearer ${discovery.authToken}` }
    })
    assert.equal(health.status, 200)
    assert.equal(v.parse(HealthJSON, await health.text()).status, 'ok')

    const client = new Client({ name: 'native-canvas-acceptance', version: '1' })
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${discovery.httpPort}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${discovery.authToken}` } }
        })
      )
      const created = await client.callTool({ name: 'new_document', arguments: {} })
      assert.notEqual(created.isError, true, JSON.stringify(created))
      const rendered = await client.callTool({
        name: 'render',
        arguments: { jsx: '<Frame name="Bundled MCP acceptance" w={180} h={80} bg="#ff0000" />' }
      })
      assert.notEqual(rendered.isError, true, JSON.stringify(rendered))
      const tree = await client.callTool({ name: 'get_page_tree', arguments: {} })
      assert.notEqual(tree.isError, true, JSON.stringify(tree))
      assert.match(JSON.stringify(tree), /Bundled MCP acceptance/)
      const undone = await client.callTool({ name: 'undo', arguments: {} })
      assert.notEqual(undone.isError, true, JSON.stringify(undone))
      const afterUndo = await client.callTool({ name: 'get_page_tree', arguments: {} })
      assert.doesNotMatch(JSON.stringify(afterUndo), /Bundled MCP acceptance/)
    } finally {
      await client.close()
    }

    // Hiding only the test app's sidecar must fail explicitly, then recover.
    const hidden = `${lookup.path}.native-test-hidden`
    renameSync(lookup.path, hidden)
    try {
      await clickRestart()
      await browser.waitUntil(async () => (await mcpAlert()) === NOT_INSTALLED, {
        timeout: 30_000,
        timeoutMsg: `MCP failure alert was: ${await mcpAlert()}`
      })
    } finally {
      renameSync(hidden, lookup.path)
    }

    await clickRestart()
    await waitForStatus('Running')
  })
})
