import type { Page } from '@playwright/test'

/** Hold reasoning open until the test explicitly completes the turn. */
export async function installReasoningTransport(
  page: Page,
  finishReason: 'stop' | 'length' | null = 'stop'
): Promise<void> {
  await page.evaluate((finishReason) => {
    window.openPencil?.setChatTransport(() => ({
      async sendMessages() {
        return new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'start', messageId: crypto.randomUUID() })
            controller.enqueue({ type: 'reasoning-start', id: 'thinking' })
            controller.enqueue({
              type: 'reasoning-delta',
              id: 'thinking',
              delta: 'Inspecting the selected layout.'
            })
            window.addEventListener(
              'finish-test-reasoning',
              () => {
                controller.enqueue({ type: 'reasoning-end', id: 'thinking' })
                controller.enqueue({ type: 'text-start', id: 'answer' })
                controller.enqueue({
                  type: 'text-delta',
                  id: 'answer',
                  delta: 'Finished inspecting the layout.'
                })
                controller.enqueue({ type: 'text-end', id: 'answer' })
                if (finishReason) controller.enqueue({ type: 'finish', finishReason })
                controller.close()
              },
              { once: true }
            )
          }
        })
      },
      async reconnectToStream() {
        return null
      }
    }))
  }, finishReason)
}

export async function finishReasoning(page: Page): Promise<void> {
  await page.evaluate(() => window.dispatchEvent(new Event('finish-test-reasoning')))
}
