import { expect, test } from 'bun:test'

import { toUint8Array } from 'js-base64'

import { SceneGraph } from '@open-pencil/scene-graph'
import { copyFills } from '@open-pencil/scene-graph/copy'

import { FigmaAPI } from '#core/figma-api'
import { importImage, registerImageFileReader } from '#core/tools/image-file'
import { setFill } from '#core/tools/modify/paint'

const png = toUint8Array(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ZkAAAAASUVORK5CYII='
)

test('file import stores original bytes and preserves frame geometry, children and scrim', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  const frame = figma.createFrame()
  frame.resize(400, 300)
  const child = figma.createText()
  frame.appendChild(child)
  setFill.execute(figma, {
    id: frame.id,
    color: '#00000000',
    color_end: '#000000FF',
    gradient: 'top-bottom'
  })
  const scrim = structuredClone(frame.fills[0])
  const paths: string[] = []
  registerImageFileReader(figma, async (path) => {
    paths.push(path)
    return png
  })
  const result = await importImage.execute(figma, { id: frame.id, path: '/renders/final.png' })
  expect(paths).toEqual(['/renders/final.png'])
  expect(result).toMatchObject({
    id: frame.id,
    source_path: '/renders/final.png',
    source_bytes: png.length,
    mimeType: 'image/png'
  })
  const image = frame.fills.find((fill) => fill.type === 'IMAGE')
  if (!image?.imageHash) throw new Error('Missing imported image')
  expect(figma.graph.images.get(image.imageHash)).toEqual(png)
  expect(frame.fills).toHaveLength(2)
  expect(frame.fills[1]).toEqual(scrim)
  expect(frame.children.map((node) => node.id)).toEqual([child.id])
  expect([frame.width, frame.height]).toEqual([400, 300])
})

test('file read and invalid image failures preserve the existing fill', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  const frame = figma.createFrame()
  const before = copyFills([...frame.fills])
  await expect(importImage.execute(figma, { id: frame.id, path: '/missing' })).rejects.toThrow(
    'unavailable'
  )
  registerImageFileReader(figma, async () => new TextEncoder().encode('not an image'))
  await expect(importImage.execute(figma, { id: frame.id, path: '/invalid' })).rejects.toThrow(
    'Expected a PNG'
  )
  registerImageFileReader(figma, async () => {
    throw new Error('Read denied')
  })
  await expect(importImage.execute(figma, { id: frame.id, path: '/denied' })).rejects.toThrow(
    'Read denied'
  )
  expect(frame.fills).toEqual(before)
  expect(figma.graph.images.size).toBe(0)
})

test('a file with an image header but invalid encoded pixels is rejected before mutation', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  const frame = figma.createFrame()
  const before = copyFills([...frame.fills])
  figma.rasterCodec = { decode: () => null, encodePNG: () => null }
  registerImageFileReader(figma, async () => png)
  await expect(
    importImage.execute(figma, { id: frame.id, path: '/renders/broken.png' })
  ).rejects.toThrow()
  expect(frame.fills).toEqual(before)
  expect(figma.graph.images.size).toBe(0)
})
