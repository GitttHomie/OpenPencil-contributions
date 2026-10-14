import { expect, test } from 'bun:test'

import { FigmaAPI } from '@open-pencil/core/figma-api'
import { SceneGraph } from '@open-pencil/scene-graph'

import { exportImage } from '#core/tools/vector/export'

test('large chat previews are reduced before reaching the MCP response limit', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  const frame = figma.createFrame()
  frame.resize(1280, 800)
  const scales: number[] = []
  figma.exportImage = async (_ids, options) => {
    const scale = options.scale ?? 1
    scales.push(scale)
    return new Uint8Array(scale >= 1 ? 1_000_000 : 300_000)
  }
  const result = await exportImage.execute(figma, { ids: [frame.id] })
  expect(scales).toEqual([1, 0.5])
  expect(result).toMatchObject({
    previewReduced: true,
    width: 640,
    height: 400,
    byteLength: 300_000,
    scale: 0.5
  })
  expect(frame.width).toBe(1280)
  expect(frame.height).toBe(800)
})

test('file exports retain the requested resolution and bytes', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  const frame = figma.createFrame()
  frame.resize(1200, 800)
  const scales: number[] = []
  figma.exportImage = async (_ids, options) => {
    scales.push(options.scale ?? 1)
    return new Uint8Array(1_000_000)
  }
  const result = await exportImage.execute(figma, {
    ids: [frame.id],
    path: 'render.png',
    scale: 2,
    maxEdge: 4096
  })
  expect(scales).toEqual([2])
  expect(result).toMatchObject({ width: 2400, height: 1600, byteLength: 1_000_000, scale: 2 })
  expect(result).not.toHaveProperty('previewReduced')
})

test('preview reduction is bounded if the exporter cannot produce a smaller image', async () => {
  const figma = new FigmaAPI(new SceneGraph())
  figma.createFrame().resize(1200, 800)
  let calls = 0
  figma.exportImage = async () => {
    calls++
    return new Uint8Array(1_000_000)
  }
  expect(await exportImage.execute(figma, {})).toHaveProperty('error')
  expect(calls).toBe(5)
})
