import type { ContentBlock } from '@agentclientprotocol/sdk'
import type { UIMessage } from 'ai'
import { isValid } from 'js-base64'

export function imagePrompt(
  purpose: 'design' | 'review' | 'vision' | 'catalog' | 'verification',
  supportsImages: boolean,
  user: UIMessage | undefined,
  images: Array<{ data: string; mimeType: string }>,
  screenshot?: string
): ContentBlock[] {
  if (purpose === 'vision') {
    if (!supportsImages) throw new Error('This CLI connection does not accept images.')
    if (!images.length) throw new Error('No images supplied for visual inspection.')
    return images.map((image) => ({ type: 'image', ...image }))
  }
  if (purpose === 'review') {
    if (supportsImages && screenshot)
      return [{ type: 'image', data: screenshot, mimeType: 'image/png' }]
    return [
      {
        type: 'text',
        text: 'No screenshot is available. Review the structural snapshot only; do not claim to have checked rendered appearance.'
      }
    ]
  }
  if (purpose !== 'design' || !supportsImages) return []
  const result: ContentBlock[] = []
  for (const part of user?.parts ?? []) {
    if (part.type !== 'file' || !part.mediaType.startsWith('image/')) continue
    const prefix = `data:${part.mediaType};base64,`
    if (!part.url.startsWith(prefix)) continue
    const data = part.url.slice(prefix.length)
    if (isValid(data)) result.push({ type: 'image', mimeType: part.mediaType, data })
  }
  return result
}
