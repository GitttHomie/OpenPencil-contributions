import { fromUint8Array } from 'js-base64'

/** Only the pixels contain the expected answer; no user image or document is sent. */
export async function createImageProbe(): Promise<{ data: string; expected: string }> {
  const digits = crypto.getRandomValues(new Uint8Array(6))
  const expected = [...digits].map((value) => String(value % 10)).join('')
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 96
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not create the image-support test.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.fillStyle = '#000000'
  context.font = 'bold 48px monospace'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(expected, 160, 48)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  if (!blob) throw new Error('Could not create the image-support test.')
  return { data: fromUint8Array(new Uint8Array(await blob.arrayBuffer())), expected }
}
