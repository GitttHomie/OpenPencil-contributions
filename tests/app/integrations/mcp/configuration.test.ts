import { expect, spyOn, test } from 'bun:test'

import { acpLaunchOptions } from '@/app/ai/acp/launch'
import { classifyAIChatError } from '@/app/ai/chat/failure'
import {
  createMCPConnectionDraft,
  mcpConnectionSettingsSnapshot,
  replaceMCPConnectionSettings,
  saveMCPConnectionDraft,
  removeMCPConnection,
  parseMCPConnectionSettings,
  buildACPMCPServers
} from '@/app/integrations/mcp'
import { parseMCPImport, parseMCPEnvironment } from '@/app/integrations/mcp/configuration'
import {
  saveMCPEnvironment,
  resolveMCPEnvironment,
  mcpEnvironmentRef
} from '@/app/integrations/mcp/environment'
import { appCredentialServices } from '@/app/settings/credentials/app'
import { CredentialStoreError } from '@/app/settings/credentials/types'

const server = {
  command: '/Applications/Example MCP/bin/server',
  args: ['--workspace', '/tmp/Some project'],
  env: { EXAMPLE_HOST: 'localhost', EXAMPLE_PORT: '9876' },
  disabled: false,
  autoApprove: []
}

test('imports IDE server maps without interpreting executable paths or granting tool approval', () => {
  for (const input of [{ mcpServers: { example: server } }, { example: server }]) {
    const [entry] = parseMCPImport(JSON.stringify(input))
    expect(entry.draft).toMatchObject({
      name: 'example',
      transportType: 'stdio',
      command: server.command,
      args: server.args,
      enabled: true,
      autoApprove: []
    })
    expect(entry.environment).toEqual(server.env)
    expect(entry.draft).not.toHaveProperty('env')
  }
  expect(
    parseMCPImport(
      JSON.stringify({ example: { ...server, disabled: true, autoApprove: ['inspect'] } })
    )[0].draft
  ).toMatchObject({ enabled: false, autoApprove: ['inspect'] })
})

test('rejects malformed configuration and environment data before execution', () => {
  for (const text of [
    '{',
    '{"example":{"command":42}}',
    '{"example":{"command":"x","args":"--shell"}}'
  ]) {
    expect(() => parseMCPImport(text)).toThrow()
  }
  expect(() => parseMCPEnvironment('{"TOKEN":42}')).toThrow()
  expect(() => parseMCPEnvironment('{"BAD=KEY":"x"}')).toThrow()
})

test('local settings round-trip, isolate chat selection, and stay separate from Codex launch configuration', async () => {
  const previous = mcpConnectionSettingsSnapshot()
  try {
    replaceMCPConnectionSettings({ version: 1, connections: [] })
    const [entry] = parseMCPImport(JSON.stringify({ example: { ...server, env: {} } }))
    const saved = saveMCPConnectionDraft(entry.draft)
    const reopened = createMCPConnectionDraft(saved)
    expect(reopened.command).toBe(server.command)
    expect(reopened.args).toEqual(server.args)
    expect(
      parseMCPConnectionSettings(mcpConnectionSettingsSnapshot()).connections[0].transport
    ).toEqual(saved.transport)
    expect(await buildACPMCPServers({ authorizationToken: null, connectionIds: [] })).toHaveLength(
      1
    )
    expect(
      (await buildACPMCPServers({ authorizationToken: null, connectionIds: [saved.id] }))[1]
    ).toEqual({
      name: 'example',
      command: server.command,
      args: server.args,
      env: []
    })
    expect(acpLaunchOptions('codex')).toEqual({ args: [], env: {} })
  } finally {
    replaceMCPConnectionSettings(previous)
  }
})

test('environment values resolve from credentials, never settings, and are removed with the connection', async () => {
  const previous = mcpConnectionSettingsSnapshot()
  const saved = saveMCPConnectionDraft({
    ...createMCPConnectionDraft(),
    name: 'Credential test',
    transportType: 'stdio',
    command: 'test-server',
    hasEnvironment: true
  })
  try {
    await saveMCPEnvironment(saved.id, '{"TEST_TOKEN":"private-test-value"}')
    expect(JSON.stringify(mcpConnectionSettingsSnapshot())).not.toContain('private-test-value')
    expect(await resolveMCPEnvironment(saved)).toEqual({ TEST_TOKEN: 'private-test-value' })
    await removeMCPConnection(saved.id)
    expect(await appCredentialServices.resolver.resolve(mcpEnvironmentRef(saved.id))).toBeNull()
  } finally {
    await appCredentialServices.manager.clear(mcpEnvironmentRef(saved.id))
    replaceMCPConnectionSettings(previous)
  }
})

test('denied external credentials identify their connection and can be retried without changing canvas setup', async () => {
  const previous = mcpConnectionSettingsSnapshot()
  const saved = saveMCPConnectionDraft({
    ...createMCPConnectionDraft(),
    name: 'Blender credentials test',
    enabled: true,
    transportType: 'stdio',
    command: 'test-server',
    hasEnvironment: true
  })
  const resolve = spyOn(appCredentialServices.resolver, 'resolve').mockRejectedValue(
    new CredentialStoreError('locked', 'Private backend details')
  )
  try {
    expect(
      await buildACPMCPServers({ authorizationToken: 'canvas-token', connectionIds: [] })
    ).toHaveLength(1)
    expect(resolve).not.toHaveBeenCalled()
    let failure: unknown
    try {
      await buildACPMCPServers({
        authorizationToken: 'canvas-token',
        connectionIds: [saved.id]
      })
    } catch (error) {
      failure = error
    }
    expect(classifyAIChatError(failure)).toMatchObject({
      reason: 'credential-access',
      connectionName: saved.name
    })
    expect(classifyAIChatError(failure).detail).not.toContain('Private backend details')

    resolve.mockResolvedValue('{"BLENDER_MCP_PORT":"9876"}')
    const servers = await buildACPMCPServers({
      authorizationToken: 'canvas-token',
      connectionIds: [saved.id]
    })
    expect(servers).toHaveLength(2)
    expect(servers[1]).toMatchObject({
      name: saved.name,
      env: [{ name: 'BLENDER_MCP_PORT', value: '9876' }]
    })
  } finally {
    resolve.mockRestore()
    replaceMCPConnectionSettings(previous)
  }
})
