import { MAX_IMAGE_FILE_BYTES } from '@open-pencil/core/tools'

/** Read at most the import limit, including when a file grows while it is open. */
export async function readLocalImageFile(path: string): Promise<Uint8Array> {
  const { open } = await import('@tauri-apps/plugin-fs')
  const file = await open(path, { read: true })
  try {
    const stat = await file.stat()
    if (!stat.isFile || stat.size <= 0 || stat.size > MAX_IMAGE_FILE_BYTES)
      throw new Error('Choose an image file no larger than 20 MiB.')
    const bytes = new Uint8Array(stat.size + 1)
    let offset = 0
    while (offset < bytes.length) {
      const count = await file.read(bytes.subarray(offset))
      if (count === null || count === 0) break
      offset += count
    }
    if (offset !== stat.size) throw new Error('The image file changed while being read. Retry.')
    return bytes.slice(0, offset)
  } finally {
    await file.close()
  }
}
