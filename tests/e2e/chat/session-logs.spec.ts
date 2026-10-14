import { readFile } from 'node:fs/promises'

import { unzipSync } from 'fflate'
import { toUint8Array } from 'js-base64'

import { expect, test } from '#tests/helpers/chat/fixture'

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69cbGAAAAABJRU5ErkJggg=='

test('tool images preview both input and output and session export keeps original bytes separately', async ({
  configuredChat: chat,
  page
}) => {
  await chat.submit('Show an image tool result')
  const call = chat.assistantMessage().locator('[data-slot="chat-tool-call"]')
  await call.getByRole('button', { name: /Set Image Fill/ }).click()
  await expect(call.locator('img')).toBeVisible()
  await expect(call.getByRole('button', { name: 'Download', exact: true })).toBeVisible()
  await expect(call).not.toContainText(PNG)
  await call.getByRole('button', { name: 'Input', exact: true }).click()
  await expect(call.locator('img')).toBeVisible()
  await expect(call).not.toContainText(PNG)
  await page.getByTestId('app-settings-trigger').click()
  await page.getByTestId('settings-section-diagnostics').click()
  const section = page.getByRole('region', { name: 'AI session logs', exact: true })
  const picker = await page.evaluateHandle(() => {
    const saved = window.showSaveFilePicker
    window.showSaveFilePicker = undefined
    return () => {
      window.showSaveFilePicker = saved
    }
  })
  try {
    const download = page.waitForEvent('download')
    await section.getByRole('button', { name: 'Export session logs' }).click()
    const path = await (await download).path()
    if (!path) throw new Error('Missing log archive')
    const archive = unzipSync(await readFile(path))
    const transcript = Object.entries(archive).find(([name]) => name.endsWith('session.jsonl'))
    const image = Object.entries(archive).find(([name]) => name.endsWith('/images/1.png'))
    expect(transcript).toBeDefined()
    expect(image?.[1]).toEqual(toUint8Array(PNG))
    const text = new TextDecoder().decode(transcript?.[1])
    expect(text).toContain('Show an image tool result')
    expect(text).toContain('tool-input-available')
    expect(text).toContain('images/1.png')
    expect(text).not.toContain(PNG)
    expect(text).not.toContain('sk-or-test-key')
    await section.getByRole('switch', { name: 'Record AI sessions' }).click()
    await expect(section.getByRole('switch', { name: 'Record AI sessions' })).not.toBeChecked()
    await section.getByRole('button', { name: 'Clear session logs' }).click()
  } finally {
    await picker.evaluate((restore) => restore())
    await picker.dispose()
  }
})
