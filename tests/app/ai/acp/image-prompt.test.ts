import { expect, test } from 'bun:test'

import type { UIMessage } from 'ai'

import { imagePrompt } from '@/app/ai/acp/image-prompt'

const user: UIMessage = {
  id: 'review',
  role: 'user',
  parts: [
    { type: 'text', text: 'Check this design.' },
    { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,AQID' },
    { type: 'file', mediaType: 'image/png', url: 'https://example.test/private.png' },
    { type: 'file', mediaType: 'image/png', url: 'data:image/png;base64,invalid!' }
  ]
}

test('design review continuations pass inline images only when the CLI accepts them', () => {
  expect(imagePrompt('design', true, user, [])).toEqual([
    { type: 'image', data: 'AQID', mimeType: 'image/png' }
  ])
  expect(imagePrompt('design', false, user, [])).toEqual([])
})

test('isolated image analysis never silently drops unsupported images', () => {
  expect(() =>
    imagePrompt('vision', false, user, [{ data: 'AQID', mimeType: 'image/png' }])
  ).toThrow('does not accept images')
})
