import { readFile } from 'node:fs/promises'

import { fromUint8Array } from 'js-base64'

import { expect, test } from '#tests/helpers/chat/fixture'

test('external MCP image results become undoable frames with image fills', async ({
  configuredChat: chat,
  page
}) => {
  const image = fromUint8Array(
    new Uint8Array(await readFile('tests/fixtures/vectorize/python_logo.png'))
  )
  await page.evaluate((data) => {
    window.openPencil?.setChatTransport(() => ({
      async sendMessages() {
        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start', messageId: crypto.randomUUID() })
            controller.enqueue({
              type: 'tool-input-available',
              toolCallId: 'external-image',
              toolName: 'mcp__example__screenshot',
              input: {},
              providerExecuted: true
            })
            controller.enqueue({
              type: 'tool-output-available',
              toolCallId: 'external-image',
              output: { content: [{ type: 'image', mimeType: 'image/png', data }] },
              providerExecuted: true
            })
            controller.enqueue({ type: 'finish', finishReason: 'stop' })
            controller.close()
          }
        })
      },
      async reconnectToStream() {
        return null
      }
    }))
  }, image)
  await chat.submit('Read an external image')
  await chat
    .assistantMessage()
    .getByRole('button', { name: /Done example · screenshot/i })
    .click()
  await page.getByRole('button', { name: 'Place image on canvas' }).click()
  const placed = () =>
    page.evaluate(() => {
      const store = window.openPencil?.getStore?.()
      if (!store) throw new Error('Missing store')
      return [...store.graph.nodes.values()].find((node) => node.name === 'example · screenshot')
    })
  await expect.poll(placed).toMatchObject({
    type: 'FRAME',
    fills: [{ type: 'IMAGE', imageScaleMode: 'FILL' }]
  })
  await page.getByTestId('canvas-area').click({ position: { x: 20, y: 20 } })
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+z' : 'Control+z')
  await expect.poll(placed).toBeUndefined()
})

test('the per-chat tool picker keeps connections with their conversation', async ({
  configuredChat: chat,
  page
}) => {
  await page.evaluate(async () => {
    const path = '/src/app/integrations/mcp/store.ts'
    const { replaceMCPConnectionSettings } = await import(path)
    replaceMCPConnectionSettings({
      version: 1,
      connections: [
        {
          id: 'mcp-example',
          name: 'Example',
          enabled: true,
          transport: { type: 'streamable-http', url: 'https://example.com/mcp' },
          authentication: { type: 'none' }
        }
      ]
    })
  })
  await page.getByRole('button', { name: 'Tools for this chat', exact: true }).click()
  await page.getByRole('switch', { name: 'Example', exact: true }).click()
  await expect(page.getByRole('switch', { name: 'Example', exact: true })).toBeChecked()
  await page.keyboard.press('Escape')
  await chat.submit('Remember my selected tools')
  await expect(chat.assistantMessage()).toContainText('mock response')
  await page.getByRole('button', { name: 'Tools for this chat', exact: true }).click()
  await expect(page.getByRole('switch', { name: 'Example', exact: true })).toBeChecked()
})
