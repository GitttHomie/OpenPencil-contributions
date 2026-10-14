import { fromUint8Array } from 'js-base64'
import * as v from 'valibot'

import type { FigmaAPI } from '#core/figma-api'
import { nodeIdInput } from '#core/tools/input'
import { setImageFill } from '#core/tools/modify/paint'
import { defineTool } from '#core/tools/schema'

export const MAX_IMAGE_FILE_BYTES = 20 * 1024 * 1024
export type ImageFileReader = (path: string) => Promise<Uint8Array>

const readers = new WeakMap<FigmaAPI, ImageFileReader>()

/** Host-owned file access; Core never opens filesystem paths itself. */
export function registerImageFileReader(figma: FigmaAPI, reader: ImageFileReader): void {
  readers.set(figma, reader)
}

export function imageFileMimeType(bytes: Uint8Array): string {
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_FILE_BYTES)
    throw new Error('Image files must be non-empty and no larger than 20 MiB.')
  const startsWith = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte)
  if (bytes.length >= 24 && startsWith([137, 80, 78, 71, 13, 10, 26, 10])) return 'image/png'
  if (bytes.length >= 4 && startsWith([255, 216, 255])) return 'image/jpeg'
  if (bytes.length >= 20 && startsWith([82, 73, 70, 70]) && startsWith([87, 69, 66, 80], 8))
    return 'image/webp'
  throw new Error('Expected a PNG, JPEG, or WebP image file.')
}

export const imageFileInput = v.strictObject({
  id: nodeIdInput,
  path: v.pipe(v.string(), v.minLength(1), v.description('Path to the original image file')),
  scale_mode: v.optional(v.picklist(['FILL', 'FIT', 'CROP', 'TILE']), 'FILL')
})

export const importImage = defineTool({
  name: 'import_image',
  description:
    'Apply an original PNG, JPEG, or WebP file to an existing frame as an image fill, without ' +
    'resizing or recompressing its bytes. Prefer this for Blender renders and other files on disk: ' +
    'pass the actual final render path, never a screenshot, thumbnail, or Base64 copied from model ' +
    'vision. Preserves children and overlay fills. Returns the source path, byte count and image hash. ' +
    'Local file access requires desktop or a filesystem-enabled MCP server.',
  execution: { kind: 'async', mutation: 'document' },
  capabilities: ['filesystem:read', 'document:write'],
  exposure: { webmcp: false },
  input: imageFileInput,
  async execute(figma, { id, path, scale_mode }) {
    const node = figma.getNodeById(id)
    if (!node) throw new Error(`Node "${id}" not found`)
    const reader = readers.get(figma)
    if (!reader) throw new Error('Local image import is unavailable in this host.')
    const bytes = await reader(path)
    const mimeType = imageFileMimeType(bytes)
    const result = setImageFill.execute(figma, {
      id,
      image_data: fromUint8Array(bytes),
      scale_mode
    })
    return {
      ...v.parse(v.looseObject({ id: v.string(), imageHash: v.string() }), result),
      source_path: path,
      source_bytes: bytes.length,
      mimeType
    }
  }
})
