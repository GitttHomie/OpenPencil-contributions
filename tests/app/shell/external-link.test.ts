import { afterEach, expect, test } from 'bun:test'

import { openExternalLink } from '@/app/shell/ui'

import { clearTauriMocks, mockTauriIPC } from '#tests/helpers/tauri/mocks'

afterEach(clearTauriMocks)

test('a handled desktop link stops bubbling before opening exactly once through the opener', async () => {
  const commands: string[] = []
  const url = 'https://openpencil.dev/programmable/mcp-server#webmcp'
  await mockTauriIPC((command, args) => {
    commands.push(command)
    expect(args).toEqual({ url, with: undefined })
    return null
  })
  const event = new Event('click', { bubbles: true, cancelable: true })
  const opening = openExternalLink(url, event)
  // Consumption must happen synchronously, before native imports/IPC resolve.
  expect(event.defaultPrevented).toBe(true)
  expect(event.cancelBubble).toBe(true)
  await opening
  expect(commands).toEqual(['plugin:opener|open_url'])
})
