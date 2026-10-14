import {
  chatDocumentId,
  closeChatDocument,
  openChatDocument,
  switchChatDocument
} from '#tests/helpers/chat/documents'
import { expect, test } from '#tests/helpers/chat/fixture'
import { finishReasoning, installReasoningTransport } from '#tests/helpers/chat/reasoning'
import { documentState, setupCanvas } from '#tests/helpers/chat/render-preview'
import { installRenderStream } from '#tests/helpers/chat/render-stream'

test('opening and switching documents preserves a live reply and its background completion', async ({
  configuredChat: chat,
  page
}) => {
  await installReasoningTransport(page)
  const first = await chatDocumentId(page)
  await chat.submit('Inspect the first document')
  const status = page.getByTestId('chat-run-status')
  await expect(status).toHaveAttribute('data-state', 'working')

  const second = await openChatDocument(page)
  await expect(chat.input).toBeVisible()
  await expect(page.getByTestId('chat-message-user')).toHaveCount(0)
  await expect(status).toHaveCount(0)
  await switchChatDocument(page, first)
  await expect(chat.userMessage()).toContainText('Inspect the first document')
  await expect(status).toHaveAttribute('data-state', 'working')

  await switchChatDocument(page, second)
  await finishReasoning(page)
  await expect(page.getByTestId('chat-message-user')).toHaveCount(0)
  await switchChatDocument(page, first)
  await expect(status).toHaveAttribute('data-state', 'finished')
  await expect(chat.assistantMessage()).toContainText('Finished inspecting the layout.')
  await expect(page.getByTestId('chat-stop-button')).toBeHidden()
})

test('closed document chat state releases its editor', async ({
  configuredChat: chat,
  page,
  browserName
}) => {
  test.skip(browserName !== 'chromium', 'Forced garbage collection requires Chromium CDP')
  const cdp = await page.context().newCDPSession(page)
  const closed = await page.evaluateHandle(() => [] as WeakRef<object>[])
  try {
    for (let cycle = 0; cycle < 3; cycle++) {
      const id = await openChatDocument(page)
      await expect(chat.input).toBeVisible()
      await closed.evaluate((references) => {
        const editor = window.openPencil?.getStore?.()
        if (!editor) throw new Error('Missing editor')
        references.push(new WeakRef(editor))
      })
      await closeChatDocument(page, id)
    }
    await expect
      .poll(async () => {
        await cdp.send('HeapProfiler.collectGarbage')
        return closed.evaluate(
          (references) => references.filter((reference) => reference.deref()).length
        )
      })
      .toBe(0)
  } finally {
    await closed.dispose()
    await cdp.detach()
  }
})

test('a background render edits its original document and keeps its reply undoable', async ({
  configuredChat: chat,
  page
}) => {
  await setupCanvas(page)
  const first = await chatDocumentId(page)
  const stream = await installRenderStream(page, {
    jsx: '<Frame name="Background card" w={240} h={120} bg="#3355CC" />',
    pauseAfter: ['Background card']
  })
  try {
    await chat.submit('Create a card in this document')
    await expect.poll(() => stream.evaluate((control) => control.ready())).toBe(true)
    await openChatDocument(page)
    await stream.evaluate((control) => control.complete())
    await expect.poll(() => stream.evaluate((control) => control.requestCount())).toBe(2)
    expect((await documentState(page)).children).toEqual([])
    await expect(page.getByTestId('chat-message-user')).toHaveCount(0)

    await switchChatDocument(page, first)
    await expect(chat.assistantMessage()).toContainText('Rendered.')
    expect((await documentState(page)).children).toHaveLength(1)
    await chat.assistantMessage().getByTestId('chat-revert-turn').click()
    expect((await documentState(page)).children).toEqual([])
  } finally {
    await stream.evaluate((control) => control.dispose())
    await stream.dispose()
  }
})
