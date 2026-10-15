import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { createRequestTracingProbe } from '#tests/helpers/mcp/request-tracing'

test('MCP traces correlate concurrent reads across document switches', async ({
  page
}, testInfo) => {
  const canvas = new CanvasHelper(page)
  await page.goto('/?test')
  await canvas.waitForInit()
  const probe = await createRequestTracingProbe(page)
  try {
    await probe.evaluate((p) => p.readOnce())
    await probe.evaluate((p) => p.readWhileSwitching())
    await expect
      .poll(async () => {
        const records = await probe.evaluate((p) => p.records())
        return records.filter(
          ({ attributes }) => attributes?.origin === 'helper' && attributes.phase === 'completed'
        ).length
      })
      .toBeGreaterThanOrEqual(4)
    const records = await probe.evaluate((p) => p.records())
    const completed = records.filter(
      ({ attributes }) => attributes?.origin === 'helper' && attributes.phase === 'completed'
    )
    expect(new Set(completed.map(({ attributes }) => attributes?.requestId)).size).toBe(4)
    for (const { attributes } of completed) {
      const matching = records.filter(
        (record) => record.attributes?.requestId === attributes?.requestId
      )
      expect(matching.some((record) => record.attributes?.phase === 'received')).toBe(true)
      expect(matching.some((record) => record.attributes?.phase === 'responding')).toBe(true)
    }
    expect(records.some(({ attributes }) => attributes?.event === 'active-document')).toBe(true)
    for (const { attributes } of records) {
      expect(attributes).not.toHaveProperty('args')
      expect(attributes).not.toHaveProperty('result')
      expect(attributes).not.toHaveProperty('token')
    }
    await canvas.waitForInit()
    canvas.assertNoErrors()
  } finally {
    const tracePath = testInfo.outputPath('mcp-request-traces.json')
    await writeFile(tracePath, JSON.stringify(await probe.evaluate((p) => p.records()), null, 2))
    await testInfo.attach('mcp-request-traces', {
      path: tracePath,
      contentType: 'application/json'
    })
    await probe.dispose()
  }
})
import { writeFile } from 'node:fs/promises'
