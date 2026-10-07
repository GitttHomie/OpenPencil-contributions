import { expect, test } from '#tests/helpers/chat/fixture'

const IMAGE = 'tests/fixtures/vectorize/pilot_avatar.png'

// Playwright's WebKit contexts are private, like Safari Private Browsing, where IndexedDB
// cannot store Blobs; a conversation with an image preview must still save.
test('a conversation with an image keeps saving in a private WebKit context', async ({
  configuredChat: chat
}) => {
  await chat.page.route('https://openrouter.ai/api/v1/chat/completions', (route) =>
    route.fulfill({
      json: {
        id: 'image-analysis',
        object: 'chat.completion',
        created: 1,
        model: 'vision-test',
        choices: [
          {
            index: 0,
            finish_reason: 'stop',
            message: { role: 'assistant', content: 'A portrait suitable for a hero image.' }
          }
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 }
      }
    })
  )
  await chat.input.fill('Use this image for the hero')
  const chooser = chat.page.waitForEvent('filechooser')
  await chat.page.getByRole('button', { name: 'Attach images' }).click()
  await (await chooser).setFiles([IMAGE])
  await chat.sendButton.click()
  await expect(
    chat.userMessage().getByRole('button', { name: 'View attachment pilot_avatar.png' })
  ).toBeVisible()

  await chat.submit('And a caption below it')
  await expect(chat.assistantMessage()).toBeVisible()

  const storedTexts = () =>
    chat.page.evaluate(async () => {
      const historyPath = '/src/app/ai/chat/history/idb.ts'
      const { createConversationStore } = await import(historyPath)
      const store = createConversationStore()
      const [latest] = await store.list(undefined)
      const conversation = latest ? await store.read(latest.id) : null
      return (conversation?.messages ?? []).map(
        (entry: { displayText?: string }) => entry.displayText ?? ''
      )
    })
  await expect.poll(storedTexts).toContain('And a caption below it')
  await expect(chat.page.getByText(/Chat history could not be saved/)).toHaveCount(0)
})
