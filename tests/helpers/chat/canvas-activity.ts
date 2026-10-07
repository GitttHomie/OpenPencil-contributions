import type { Page } from '@playwright/test'

import type * as ActivityModule from '@/app/ai/acp/canvas/activity'

export async function createCanvasActivityProbe(page: Page) {
  const handle = await page.evaluateHandle(async () => {
    const path = '/src/app/ai/acp/canvas/activity.ts'
    const { createACPCanvasActivity } = (await import(path)) as typeof ActivityModule
    const store = window.openPencil?.getStore?.()
    if (!store) throw new Error('OpenPencil store not initialized')
    const activity = createACPCanvasActivity(store, 'test-agent')
    return {
      start: activity.start,
      finish: activity.finish,
      snapshot() {
        return {
          cursors: store.state.presenceCursors,
          children: store.graph.getNode(store.state.currentPageId)?.childIds
        }
      },
      render() {
        const node = store.graph.createNode('FRAME', store.state.currentPageId, {
          name: 'Agent card',
          x: 200,
          y: 150,
          width: 160,
          height: 100
        })
        activity.update({
          sessionUpdate: 'tool_call',
          toolCallId: 'render-card',
          title: 'mcp.open-pencil.render',
          status: 'completed',
          rawOutput: {
            result: { content: [{ type: 'text', text: JSON.stringify({ id: node.id }) }] }
          }
        })
        return node.id
      }
    }
  })
  return {
    start: () => handle.evaluate((probe) => probe.start()),
    finish: () => handle.evaluate((probe) => probe.finish()),
    snapshot: () => handle.evaluate((probe) => probe.snapshot()),
    render: () => handle.evaluate((probe) => probe.render()),
    async dispose() {
      await handle.evaluate((probe) => probe.finish())
      await handle.dispose()
    }
  }
}
