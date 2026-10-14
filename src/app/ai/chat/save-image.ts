import { toUint8Array } from 'js-base64'

import { saveExportedFile } from '@/app/document/export/files'
import { downloadBlob } from '@/app/document/io/browser'

import { chatImage } from './media'

/** Save the supplied bytes as-is; never render a thumbnail back into an image file. */
export async function saveChatImage(url: string): Promise<void> {
  const image = chatImage(url)
  if (!image) throw new Error('Invalid image')
  const extension = image.mimeType === 'image/jpeg' ? 'jpg' : image.mimeType.slice(6)
  await saveExportedFile(
    toUint8Array(image.url.slice(image.url.indexOf(',') + 1)),
    `image.${extension}`,
    extension.toUpperCase(),
    `.${extension}`,
    image.mimeType,
    downloadBlob
  )
}
