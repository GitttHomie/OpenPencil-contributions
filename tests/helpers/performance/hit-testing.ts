import type { Page } from '@playwright/test'

export async function measureHitTesting(page: Page, run: () => Promise<void>) {
  const probe = await page.evaluateHandle(() => {
    const graph = window.openPencil?.getStore?.().graph
    if (!graph) throw new Error('OpenPencil graph not initialized')
    const original = graph.hitTest
    const originalDeep = graph.hitTestDeep
    let calls = 0
    let totalMs = 0
    function measure(run: () => ReturnType<typeof graph.hitTest>) {
      const start = performance.now()
      const result = run()
      totalMs += performance.now() - start
      calls++
      return result
    }
    graph.hitTest = (...args) => measure(() => original.apply(graph, args))
    graph.hitTestDeep = (...args) => measure(() => originalDeep.apply(graph, args))
    return {
      read: () => ({ calls, totalMs }),
      dispose: () => {
        graph.hitTest = original
        graph.hitTestDeep = originalDeep
      }
    }
  })
  try {
    await run()
    return await probe.evaluate((probe) => probe.read())
  } finally {
    try {
      await probe.evaluate((probe) => probe.dispose())
    } finally {
      await probe.dispose()
    }
  }
}
