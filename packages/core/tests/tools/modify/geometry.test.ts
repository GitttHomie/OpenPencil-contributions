import { expect, test } from 'bun:test'

import { tool } from 'ai'

import { SceneGraph } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { executeAtomicTool } from '#core/editor/history/atomic-tool'
import { FigmaAPI } from '#core/figma-api'
import { toolsToAI } from '#core/tools/ai-adapter'
import { setRadius } from '#core/tools/modify/geometry'

function setup() {
  const figma = new FigmaAPI(new SceneGraph())
  return { figma, frame: figma.createFrame() }
}

test('AI can set smoothing with radii, preserve it on radius edits, and explicitly reset it', async () => {
  const { figma, frame } = setup()
  const tools = toolsToAI([setRadius], { getFigma: () => figma }, { tool })
  const execute = tools.set_radius.execute
  if (!execute) throw new Error('Missing set_radius execution')
  expect(
    await execute(
      { id: frame.id, radius: 16, corner_smoothing: 0.6 },
      { toolCallId: 'corners', messages: [] }
    )
  ).toMatchObject({ cornerRadius: 16, cornerSmoothing: 0.6 })
  expect(frame.cornerSmoothing).toBe(0.6)
  expect(setRadius.execute(figma, { id: frame.id, top_left: 4 })).toMatchObject({
    topLeftRadius: 4,
    topRightRadius: 16,
    cornerSmoothing: 0.6
  })
  expect(setRadius.execute(figma, { id: frame.id, corner_smoothing: 0 })).toMatchObject({
    topLeftRadius: 4,
    cornerSmoothing: 0
  })
  expect(frame.cornerSmoothing).toBe(0)
})

test('invalid smoothing is rejected before any radius changes', () => {
  const { figma, frame } = setup()
  frame.cornerRadius = 8
  for (const corner_smoothing of [-0.1, 1.1, 60, Number.NaN, Infinity]) {
    expect(() => setRadius.execute(figma, { id: frame.id, radius: 20, corner_smoothing })).toThrow()
    expect(frame.cornerRadius).toBe(8)
    expect(frame.cornerSmoothing).toBe(0)
  }
})

test('radius and smoothing change together in one undoable edit', () => {
  const editor = createEditor()
  try {
    const figma = new FigmaAPI(editor.graph)
    const frame = figma.createFrame()
    frame.cornerRadius = 8
    executeAtomicTool(editor, figma, setRadius, {
      id: frame.id,
      radius: 20,
      corner_smoothing: 0.6
    })
    expect([frame.cornerRadius, frame.cornerSmoothing]).toEqual([20, 0.6])
    editor.undoAction()
    expect([frame.cornerRadius, frame.cornerSmoothing]).toEqual([8, 0])
    editor.redoAction()
    expect([frame.cornerRadius, frame.cornerSmoothing]).toEqual([20, 0.6])
  } finally {
    editor.dispose()
  }
})
