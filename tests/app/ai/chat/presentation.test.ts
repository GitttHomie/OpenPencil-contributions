import { expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { coalesceReasoningParts } from '@/app/ai/chat/presentation'

test('old per-chunk ACP reasoning displays together without rewriting the saved transcript', () => {
  const parts: UIMessage['parts'] = [
    { type: 'reasoning', id: 'legacy', text: 'One ', state: 'done' },
    { type: 'reasoning', id: 'legacy', text: 'thought.', state: 'done' },
    { type: 'text', text: 'Answer.' },
    { type: 'reasoning', id: 'legacy', text: 'Later.', state: 'done' },
    { type: 'reasoning', id: 'different', text: 'Separate.', state: 'done' }
  ]
  const before = structuredClone(parts)
  expect(coalesceReasoningParts(parts)).toEqual([
    { type: 'reasoning', id: 'legacy', text: 'One thought.', state: 'done' },
    ...parts.slice(2)
  ])
  expect(parts).toEqual(before)
})
