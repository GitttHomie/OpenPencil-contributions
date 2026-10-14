import { fromUint8Array, isValid } from 'js-base64'
import * as v from 'valibot'

export interface ChatImage {
  url: string
  mimeType: string
  byteLength: number
}

const MAX_DEPTH = 32
const MAX_ENTRIES = 10_000
const MAX_IMAGE_CHARACTERS = 32 * 1024 * 1024
const DATA_IMAGE = /data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=_-]+)/g
const EMBEDDED_IMAGE = /(?:iVBORw|R0lGOD|UklGR|\/9j\/)[A-Za-z0-9+/_=-]{32,}/g
const IMAGE_FIELDS = new Set(['base64', 'image_data', 'imageData', 'data', 'bytes'])

function imageType(data: string): string | null {
  if (data.startsWith('iVBORw')) return 'image/png'
  if (data.startsWith('/9j/')) return 'image/jpeg'
  if (data.startsWith('R0lGOD')) return 'image/gif'
  if (data.startsWith('UklGR') && data.slice(11, 16) === 'XRUJQ') return 'image/webp'
  return null
}

export function chatImage(data: string): ChatImage | null {
  if (data.length > MAX_IMAGE_CHARACTERS * 1.1) return null
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([\s\S]+)$/.exec(data)
  const encoded = (match?.[2] ?? data).replace(/\s/g, '')
  if (!encoded || encoded.length > MAX_IMAGE_CHARACTERS) return null
  const mimeType = imageType(encoded)
  if (!mimeType || (match && match[1] !== mimeType) || !isValid(encoded)) return null
  return {
    url: `data:${mimeType};base64,${encoded}`,
    mimeType,
    byteLength: Math.floor((encoded.length * 3) / 4) - (encoded.match(/=*$/)?.[0].length ?? 0)
  }
}

/**
 * Project tool payloads for people without modifying the payload sent to the model.
 * Also unwrap JSON embedded in MCP text blocks, including ACP result wrappers.
 */
export function projectChatMedia(
  input: unknown,
  replaceImage?: (image: ChatImage) => unknown
): { value: unknown; images: ChatImage[] } {
  const images: ChatImage[] = []
  const seenImages = new Set<string>()
  const ancestors = new Set<object>()
  let entries = 0
  const imageValue = (image: ChatImage): unknown => {
    if (!seenImages.has(image.url)) {
      seenImages.add(image.url)
      images.push(image)
    }
    return replaceImage?.(image) ?? `[${image.mimeType}, ${image.byteLength} bytes]`
  }
  function visitString(value: string, key: string, depth: number, declaredType?: string): unknown {
    const trimmed = value.trimStart()
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), v.unknown()), value)
      if (parsed.success) return visit(parsed.output, '', depth + 1)
    }
    // A complete image can occur as the result itself, not only under a named field.
    const candidate =
      value.startsWith('data:image/') || IMAGE_FIELDS.has(key) || imageType(value) !== null
    if (candidate) {
      const image = chatImage(value)
      if (image)
        return declaredType && declaredType !== image.mimeType
          ? '[Image type mismatch; preview unavailable]'
          : imageValue(image)
      if (
        value.length > 1024 &&
        (value.startsWith('data:image/') ||
          (IMAGE_FIELDS.has(key) && /^[A-Za-z0-9+/_=-]+$/.test(value)))
      ) {
        return `[Encoded data, ${value.length} characters; preview unavailable]`
      }
    }
    return value
      .replace(DATA_IMAGE, (url) => {
        const image = chatImage(url)
        return image ? String(imageValue(image)) : '[Image preview unavailable]'
      })
      .replace(EMBEDDED_IMAGE, (encoded) => {
        const image = chatImage(encoded)
        return image ? String(imageValue(image)) : '[Encoded image; preview unavailable]'
      })
  }

  function visitBinary(value: ArrayBuffer | ArrayBufferView, declaredType?: string): unknown {
    if (value.byteLength <= MAX_IMAGE_CHARACTERS * 0.75) {
      const bytes =
        value instanceof ArrayBuffer
          ? new Uint8Array(value)
          : new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
      const image = chatImage(fromUint8Array(bytes))
      if (image && (!declaredType || declaredType === image.mimeType)) return imageValue(image)
    }
    return `[Binary data, ${value.byteLength} bytes]`
  }

  function visit(value: unknown, key = '', depth = 0, declaredType?: string): unknown {
    if (++entries > MAX_ENTRIES || depth > MAX_DEPTH) return '[Content limit reached]'
    if (typeof value === 'string') return visitString(value, key, depth, declaredType)
    if (value instanceof ArrayBuffer || ArrayBuffer.isView(value))
      return visitBinary(value, declaredType)
    if (value instanceof Blob) return `[${value.type || 'Binary data'}, ${value.size} bytes]`
    if (typeof value !== 'object' || value === null) return value
    if (ancestors.has(value)) return '[Circular reference]'
    ancestors.add(value)
    let result: unknown
    if (Array.isArray(value)) {
      const bytes =
        IMAGE_FIELDS.has(key) &&
        value.length > 32 &&
        value.every((item) => Number.isInteger(item) && item >= 0 && item <= 255)
      result = bytes
        ? visit(new Uint8Array(value), key, depth + 1, declaredType)
        : value.slice(0, MAX_ENTRIES).map((item) => visit(item, '', depth + 1))
    } else {
      let mime: unknown = declaredType
      if ('mimeType' in value) mime = value.mimeType
      else if ('mediaType' in value) mime = value.mediaType
      result = Object.fromEntries(
        Object.entries(value)
          .slice(0, MAX_ENTRIES)
          .map(([field, item]) => [
            field,
            visit(
              item,
              field,
              depth + 1,
              IMAGE_FIELDS.has(field) && typeof mime === 'string' ? mime : undefined
            )
          ])
      )
    }
    ancestors.delete(value)
    return result
  }
  return { value: visit(input), images }
}
