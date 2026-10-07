import { expect, test } from '@playwright/test'

import { CanvasHelper } from '#tests/helpers/canvas'
import { seedSpacingToken, tokenCanvasValue } from '#tests/helpers/variables/token-editor'

test('token units preserve canvas values and copied stylesheets use the chosen format', async ({
  page
}) => {
  await page.goto('/?test')
  const canvas = new CanvasHelper(page)
  await canvas.waitForInit()
  const token = await seedSpacingToken(page)
  await page
    .getByRole('region', { name: 'Variables' })
    .getByRole('button', { name: 'Open variables' })
    .click()
  await page.getByTestId('variable-row').filter({ hasText: 'gutter' }).click()
  const inspector = page.getByTestId('token-inspector')
  const value = inspector.getByRole('spinbutton', { name: 'Mode 1', exact: true })
  await inspector.getByRole('combobox', { name: 'Unit' }).click()
  await page.getByRole('option', { name: 'rem', exact: true }).click()
  await expect(value).toHaveValue('1.5')
  expect(await tokenCanvasValue(page, token.frameId)).toBe(24)
  await value.fill('2')
  await value.press('Enter')
  await expect.poll(() => tokenCanvasValue(page, token.frameId)).toBe(32)

  const output = page.getByTestId('token-output')
  await expect(output).toContainText('2rem')
  await expect(output).toContainText(':root')
  await expect(output).not.toContainText('@theme')
  const clipboard = await page.evaluateHandle(() => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const originalCommand = document.execCommand
    let text = ''
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        async write(items: ClipboardItem[]) {
          const item = items.find((entry) => entry.types.includes('text/plain'))
          if (!item) throw new Error('No copied stylesheet')
          text = await (await item.getType('text/plain')).text()
        }
      }
    })
    document.execCommand = (command, showUI, value) => {
      if (command !== 'copy') return originalCommand.call(document, command, showUI, value)
      const target = document.activeElement
      if (!(target instanceof HTMLTextAreaElement)) throw new Error('No copied text selection')
      text = target.value.slice(target.selectionStart, target.selectionEnd)
      return true
    }
    return {
      read: () => text,
      restore() {
        document.execCommand = originalCommand
        if (original) Object.defineProperty(navigator, 'clipboard', original)
        else Reflect.deleteProperty(navigator, 'clipboard')
      }
    }
  })
  try {
    await output.getByTestId('variables-copy-stylesheet').click()
    await page.getByTestId('variables-copy-tailwind').click()
    await expect.poll(() => clipboard.evaluate((handle) => handle.read())).toContain('@theme')
    await expect.poll(() => clipboard.evaluate((handle) => handle.read())).toContain('2rem')
    await output.getByTestId('variables-copy-stylesheet').click()
    await page.getByTestId('variables-copy-css').click()
    await expect.poll(() => clipboard.evaluate((handle) => handle.read())).toContain(':root')
    await expect.poll(() => clipboard.evaluate((handle) => handle.read())).not.toContain('@theme')
  } finally {
    await clipboard.evaluate((handle) => handle.restore())
    await clipboard.dispose()
  }
  canvas.assertNoErrors()
})
