import { expect, test } from 'bun:test'
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { toUint8Array } from 'js-base64'
import * as v from 'valibot'

import { importImageFile } from '#mcp/tool/image-file'

const png = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII='
)

test('MCP reads original bytes inside its root and forwards them without involving model output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openpencil-image-'))
  try {
    await writeFile(join(root, 'final.png'), png)
    const calls: Record<string, unknown>[] = []
    const result = await importImageFile(
      async (body) => {
        calls.push(body)
        return { ok: true, result: { id: 'frame', imageHash: 'original-hash' } }
      },
      root,
      { document_id: 'doc', page_id: 'page' },
      { id: 'frame', path: 'final.png', scale_mode: 'FIT' }
    )
    expect(calls).toHaveLength(1)
    const call = v.parse(
      v.object({
        command: v.literal('tool'),
        args: v.object({
          name: v.literal('set_image_fill'),
          document_id: v.literal('doc'),
          page_id: v.literal('page'),
          args: v.object({
            id: v.literal('frame'),
            scale_mode: v.literal('FIT'),
            image_data: v.string()
          })
        })
      }),
      calls[0]
    )
    expect(toUint8Array(call.args.args.image_data)).toEqual(png)
    expect(result).toMatchObject({
      id: 'frame',
      source_bytes: png.length,
      mimeType: 'image/png',
      imageHash: 'original-hash'
    })
    expect(result).not.toHaveProperty('image_data')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('invalid files, traversal and symlink escapes never reach the editor', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openpencil-image-'))
  const outside = await mkdtemp(join(tmpdir(), 'openpencil-image-outside-'))
  let calls = 0
  const send = async () => {
    calls++
    return { ok: true }
  }
  try {
    await writeFile(join(root, 'invalid.png'), 'not an image')
    await writeFile(join(outside, 'outside.png'), png)
    await symlink(join(outside, 'outside.png'), join(root, 'escape.png'))
    for (const path of [
      'invalid.png',
      'missing.png',
      'escape.png',
      join(outside, 'outside.png'),
      '../outside.png',
      '.'
    ]) {
      await expect(importImageFile(send, root, {}, { id: 'frame', path })).rejects.toThrow()
    }
    expect(calls).toBe(0)
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('an editor failure is not reported as a successful import', async () => {
  const root = await mkdtemp(join(tmpdir(), 'openpencil-image-'))
  try {
    await writeFile(join(root, 'final.png'), png)
    for (const response of [
      { ok: false, error: 'Missing frame' },
      { ok: true, result: { error: 'Missing frame' } }
    ]) {
      await expect(
        importImageFile(async () => response, root, {}, { id: 'frame', path: 'final.png' })
      ).rejects.toThrow()
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
