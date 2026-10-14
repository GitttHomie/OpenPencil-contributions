import { expect, test } from 'bun:test'

import { toUint8Array } from 'js-base64'

import { chatImage, projectChatMedia } from '@/app/ai/chat/media'

const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEAQH/69cbGAAAAABJRU5ErkJggg=='

test('extracts nested MCP images and set_image_fill inputs without changing the wire data', () => {
  const input = { arguments: { image_data: PNG, id: '1:2' } }
  const output = {
    result: { content: [{ type: 'text', text: JSON.stringify(input) }] },
    error: null
  }
  for (const payload of [
    input,
    output,
    { content: [{ type: 'image', data: PNG, mimeType: 'image/png' }] }
  ]) {
    const projected = projectChatMedia(payload)
    expect(projected.images).toHaveLength(1)
    expect(projected.images[0].url).toBe(`data:image/png;base64,${PNG}`)
    expect(projected.images[0].byteLength).toBe(toUint8Array(PNG).length)
    expect(JSON.stringify(projected.value)).not.toContain(PNG)
  }
  expect(input.arguments.image_data).toBe(PNG)
})

test('extracts images from prose and JSX while preserving surrounding text', () => {
  const code = `<Frame image="data:image/png;base64,${PNG}" />`
  const projected = projectChatMedia(code)
  expect(projected.value).toContain('<Frame image=')
  expect(projected.value).not.toContain(PNG)
  expect(projected.images).toHaveLength(1)
  expect(projectChatMedia('Draw a button with 24px padding').value).toBe(
    'Draw a button with 24px padding'
  )
  expect(projectChatMedia(`const image = '${PNG}'`).value).not.toContain(PNG)
})

test('rejects active image formats, invalid encoding and type mismatches', () => {
  expect(chatImage('data:image/svg+xml,<svg onload="alert(1)"/>')).toBeNull()
  expect(chatImage(`data:image/jpeg;base64,${PNG}`)).toBeNull()
  expect(chatImage('data:image/png;base64,not an image')).toBeNull()
})

test('summarizes binary arrays, cycles and oversize encoded data', () => {
  const value: Record<string, unknown> = { data: new Uint8Array(512), image_data: 'x'.repeat(2000) }
  value.self = value
  const projected = projectChatMedia(value)
  expect(JSON.stringify(projected.value)).not.toContain('x'.repeat(100))
  expect(projected.value).toMatchObject({
    data: '[Binary data, 512 bytes]',
    self: '[Circular reference]'
  })
})
