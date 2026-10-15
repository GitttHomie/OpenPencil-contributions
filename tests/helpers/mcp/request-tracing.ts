import type { Page } from '@playwright/test'

import type * as Endpoint from '@/app/automation/mcp/endpoint'
import type * as Spawn from '@/app/automation/mcp/spawn'
import type * as Recorder from '@/app/diagnostics/recorder'
import type * as Tabs from '@/app/tabs'

/** Exercise the authenticated development companion without exposing its token to the runner. */
export async function createRequestTracingProbe(page: Page) {
  return page.evaluateHandle(async () => {
    const endpointPath = '/src/app/automation/mcp/endpoint.ts'
    const spawnPath = '/src/app/automation/mcp/spawn.ts'
    const recorderPath = '/src/app/diagnostics/recorder.ts'
    const tabsPath = '/src/app/tabs/index.ts'
    const endpoint: typeof Endpoint = await import(endpointPath)
    const spawn: typeof Spawn = await import(spawnPath)
    const recorder: typeof Recorder = await import(recorderPath)
    const tabs: typeof Tabs = await import(tabsPath)
    const token = await spawn.getAutomationAuthToken()
    const started = Date.now()
    async function read(command: string) {
      const response = await fetch(`${endpoint.LOCAL_AUTOMATION_HTTP_URL}/rpc`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(
          command === 'list_documents'
            ? { command }
            : {
                command: 'tool',
                args: { name: command, args: command === 'find_variables' ? { query: '' } : {} }
              }
        )
      })
      if (!response.ok) throw new Error(`Read failed: HTTP ${response.status}`)
      const text = await response.text()
      if (text.includes('"ok":false')) throw new Error(text)
    }
    return {
      async readOnce() {
        await read('list_documents')
      },
      async readWhileSwitching() {
        const first = tabs.getActiveTabId()
        const second = tabs.createTab().id
        await Promise.all([
          read('find_variables'),
          read('list_available_fonts'),
          read('get_components'),
          Promise.resolve().then(() => tabs.switchTab(first))
        ])
        await tabs.closeTab(second, 'discard')
      },
      records() {
        return recorder.diagnostics
          .recent()
          .filter((event) => event.category === 'mcp' && event.timestamp >= started)
      }
    }
  })
}
