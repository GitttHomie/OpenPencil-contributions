import { expect, test } from 'bun:test'

import {
  answerCleanupPrompt,
  cleanupPrompt,
  requestFigCleanup
} from '@/app/document/io/cleanup-prompt'

const summary = {
  unused: { componentCount: 3, nodeCount: 10 },
  internal: {
    canvasCount: 1,
    componentCount: 4,
    instanceCount: 2,
    hiddenInstanceCount: 0,
    pageCount: 1,
    nodeCount: 20
  }
}

test('file-specific cleanup prompts serialize and keep independent answers', async () => {
  const first = requestFigCleanup('first.fig', summary)
  const second = requestFigCleanup('second.fig', summary)
  await Promise.resolve()
  expect(cleanupPrompt.value?.fileName).toBe('first.fig')
  answerCleanupPrompt('internal')
  expect(await first).toBe('internal')
  await Promise.resolve()
  expect(cleanupPrompt.value?.fileName).toBe('second.fig')
  answerCleanupPrompt('keep')
  expect(await second).toBe('keep')
  expect(cleanupPrompt.value).toBeNull()
})

test('canceling an import dismisses its prompt and releases the next queued open', async () => {
  const abort = new AbortController()
  const first = requestFigCleanup('canceled.fig', summary, abort.signal)
  const second = requestFigCleanup('next.fig', summary)
  await Promise.resolve()
  abort.abort()
  expect(await first).toBe('keep')
  await Promise.resolve()
  expect(cleanupPrompt.value?.fileName).toBe('next.fig')
  answerCleanupPrompt('keep')
  await second
  expect(cleanupPrompt.value).toBeNull()
})
