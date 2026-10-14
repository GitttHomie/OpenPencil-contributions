import { open } from 'node:fs/promises'

import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'

import { MAX_IMAGE_FILE_BYTES, imageFileInput, imageFileMimeType } from '@open-pencil/core/tools'

import { resolveSafePath } from './output'
import type { RPCSender } from './registration'

export async function importImageFile(
  sendRPC: RPCSender,
  root: string,
  target: { document_id?: string; page_id?: string },
  args: Record<string, unknown>
) {
  const { id, path, scale_mode } = v.parse(imageFileInput, args)
  const safe = await resolveSafePath(path, root)
  const file = await open(safe.realPath, 'r')
  let bytes: Uint8Array
  try {
    const stat = await file.stat()
    if (!stat.isFile() || stat.size <= 0 || stat.size > MAX_IMAGE_FILE_BYTES)
      throw new Error('Choose an image file no larger than 20 MiB.')
    bytes = new Uint8Array(stat.size + 1)
    let offset = 0
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes.subarray(offset))
      if (bytesRead === 0) break
      offset += bytesRead
    }
    if (offset !== stat.size) throw new Error('The image file changed while being read. Retry.')
    bytes = bytes.slice(0, offset)
  } finally {
    await file.close()
  }
  const mimeType = imageFileMimeType(bytes)
  // Bytes travel directly over RPC; the language model sees only the path and receipt.
  const response = v.parse(
    v.looseObject({
      ok: v.boolean(),
      error: v.optional(v.string()),
      result: v.optional(v.unknown())
    }),
    await sendRPC({
      command: 'tool',
      args: {
        ...target,
        name: 'set_image_fill',
        args: { id, image_data: fromUint8Array(bytes), scale_mode }
      }
    })
  )
  if (!response.ok) throw new Error(response.error ?? 'Image import failed.')
  const error = v.safeParse(v.object({ error: v.string() }), response.result)
  if (error.success) throw new Error(error.output.error)
  const result = v.safeParse(
    v.looseObject({ id: v.string(), imageHash: v.string() }),
    response.result
  )
  if (!result.success) throw new Error('The editor did not confirm the image import.')
  return {
    ...result.output,
    source_path: safe.realPath,
    source_bytes: bytes.length,
    mimeType
  }
}
