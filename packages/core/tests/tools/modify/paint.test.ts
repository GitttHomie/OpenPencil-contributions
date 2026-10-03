import { expect, test } from 'bun:test'

import { tool } from 'ai'

import { copyFills } from '@open-pencil/scene-graph/copy'

import { createEditor, executeAtomicTool } from '#core/editor'
import { gradientHandles } from '#core/geometry'
import { FigmaAPI, SceneGraph, toolsToAI } from '#core/index'
import { setFill, setImageFill } from '#core/tools/modify/paint'

function setup() {
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const frame = figma.createFrame()
  frame.resize(200, 100)
  return { graph, figma, frame }
}

const imageData = 'iVBORw0KGgo='
const scrimArgs = {
  color: '#00000000',
  color_end: '#000000CC',
  gradient: 'top-bottom',
  operation: 'append'
}

test('the AI adapter can add, verify and revise a gradient scrim without losing the photo or children', async () => {
  const { graph, figma, frame } = setup()
  const child = graph.createNode('TEXT', frame.id, { text: 'Caption' })
  const tools = toolsToAI([setFill, setImageFill], { getFigma: () => figma }, { tool })
  const execute = async (name: string, args: Record<string, unknown>) => {
    const selected = tools[name]
    if (!selected.execute) throw new Error(`Missing tool ${name}`)
    return selected.execute(args, { toolCallId: 'fixture', messages: [] })
  }
  await execute('set_image_fill', { id: frame.id, image_data: imageData })
  const imageHash = frame.fills[0].imageHash
  const result = await execute('set_fill', { id: frame.id, ...scrimArgs })
  expect(result).toMatchObject({
    fill_index: 1,
    fills: [{ type: 'IMAGE' }, { type: 'GRADIENT_LINEAR' }]
  })
  expect(frame.fills[1].gradientStops?.map((stop) => stop.color.a)).toEqual([0, 0.8])
  await execute('set_fill', { id: frame.id, color: '#FFFFFF20', operation: 'append' })
  expect(frame.fills).toHaveLength(3)
  await execute('set_fill', {
    id: frame.id,
    ...scrimArgs,
    operation: 'replace',
    fill_index: 1,
    opacity: 0.7
  })
  expect(frame.fills[1].opacity).toBe(0.7)
  expect(frame.fills[0].imageHash).toBe(imageHash)
  expect(frame.fills[2].opacity).toBeCloseTo(32 / 255)
  await execute('set_image_fill', { id: frame.id, image_data: imageData })
  expect(frame.fills).toHaveLength(3)
  expect(frame.fills[1].opacity).toBe(0.7)
  expect(graph.getNode(child.id)?.parentId).toBe(frame.id)
})

for (const [gradient, start, end] of [
  ['top-bottom', { x: 100, y: 0 }, { x: 100, y: 100 }],
  ['bottom-top', { x: 100, y: 100 }, { x: 100, y: 0 }],
  ['left-right', { x: 0, y: 50 }, { x: 200, y: 50 }],
  ['right-left', { x: 200, y: 50 }, { x: 0, y: 50 }],
  ['top-left-bottom-right', { x: 0, y: 0 }, { x: 200, y: 100 }],
  ['bottom-right-top-left', { x: 200, y: 100 }, { x: 0, y: 0 }],
  ['top-right-bottom-left', { x: 200, y: 0 }, { x: 0, y: 100 }],
  ['bottom-left-top-right', { x: 0, y: 100 }, { x: 200, y: 0 }]
] as const) {
  test(`${gradient} places start and end colors on the named edges`, () => {
    const { figma, frame } = setup()
    setFill.execute(figma, { id: frame.id, color: '#00000000', color_end: '#000000CC', gradient })
    const fill = frame.fills[0]
    if (!fill.gradientTransform) throw new Error('Missing gradient transform')
    expect(gradientHandles(fill.type, fill.gradientTransform, 200, 100)).toMatchObject({
      start,
      end
    })
  })
}

test('invalid or ambiguous fill edits leave the stack unchanged', () => {
  const { figma, frame } = setup()
  const original = copyFills([...frame.fills])
  for (const args of [
    { color: '#000000', fill_index: 5 },
    { color: '#000000', operation: 'append', fill_index: 0 },
    { color: '#000000', gradient: 'top-bottom' },
    { color: '#000000', color_end: '#FFFFFF' }
  ]) {
    expect(setFill.execute(figma, { id: frame.id, ...args })).toHaveProperty('error')
    expect(frame.fills).toEqual(original)
  }
})

test('appending a scrim is one undoable edit and restores the underlying image', () => {
  const editor = createEditor()
  try {
    const figma = new FigmaAPI(editor.graph)
    const frame = figma.createFrame()
    setImageFill.execute(figma, { id: frame.id, image_data: imageData })
    const before = copyFills([...frame.fills])
    executeAtomicTool(editor, figma, setFill, { id: frame.id, ...scrimArgs })
    expect(frame.fills).toHaveLength(2)
    editor.undoAction()
    expect(frame.fills).toEqual(before)
    editor.redoAction()
    expect(frame.fills[1].type).toBe('GRADIENT_LINEAR')
  } finally {
    editor.dispose()
  }
})
