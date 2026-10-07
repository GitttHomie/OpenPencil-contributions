import { expect, test } from 'bun:test'

import { tool } from 'ai'

import { createEditor, executeAtomicTool } from '#core/editor'
import { FigmaAPI } from '#core/figma-api'
import { toolsToAI } from '#core/tools/ai-adapter'
import { setPaint } from '#core/tools/modify/paint-stack'
import { ALL_TOOLS } from '#core/tools/registry'
import { isToolExposed } from '#core/tools/schema'

test('AI can edit a multi-stop gradient stroke without losing geometry or other paints, then undo it', async () => {
  const editor = createEditor()
  try {
    const figma = new FigmaAPI(editor.graph)
    const frame = figma.createFrame()
    frame.strokes = [
      {
        type: 'SOLID',
        color: { r: 1, g: 0, b: 0, a: 1 },
        opacity: 1,
        visible: true,
        weight: 3,
        align: 'OUTSIDE',
        cap: 'ROUND',
        dashPattern: [4, 2]
      }
    ]
    const before = structuredClone([...frame.strokes])
    const tools = toolsToAI([setPaint], { getFigma: () => figma }, { tool })
    const execute = tools.set_paint.execute
    if (!execute) throw new Error('Missing AI tool')
    await execute(
      {
        id: frame.id,
        target: 'fills',
        operation: 'append',
        paint: {
          type: 'GRADIENT_RADIAL',
          stops: [
            { color: '#00000000', position: 0 },
            { color: '#000000CC', position: 1 }
          ]
        }
      },
      { toolCallId: 'paint', messages: [] }
    )
    const fills = structuredClone([...frame.fills])
    executeAtomicTool(editor, figma, setPaint, {
      id: frame.id,
      target: 'strokes',
      operation: 'replace',
      index: 0,
      paint: {
        type: 'GRADIENT_LINEAR',
        stops: [
          { color: '#FF0000', position: 1 },
          { color: '#00FF00', position: 0.5 },
          { color: '#0000FF', position: 0 }
        ],
        transform: { m00: 0, m01: 1, m02: 0, m10: -1, m11: 0, m12: 1 }
      }
    })
    expect(frame.strokes[0]).toMatchObject({
      weight: 3,
      align: 'OUTSIDE',
      cap: 'ROUND',
      dashPattern: [4, 2]
    })
    expect(frame.strokes[0].gradientStops?.map((stop) => stop.position)).toEqual([0, 0.5, 1])
    expect(frame.fills).toEqual(fills)
    editor.undoAction()
    expect(frame.strokes).toEqual(before)
    editor.redoAction()
    expect(frame.strokes[0].type).toBe('GRADIENT_LINEAR')
    setPaint.execute(figma, { id: frame.id, target: 'strokes', operation: 'remove', index: 0 })
    expect(frame.strokes).toEqual([])
  } finally {
    editor.dispose()
  }
})

test('invalid paint operations leave both stacks unchanged', () => {
  const editor = createEditor()
  try {
    const figma = new FigmaAPI(editor.graph)
    const frame = figma.createFrame()
    const before = structuredClone([...frame.fills])
    for (const args of [
      { operation: 'remove', index: 99 },
      { operation: 'replace', index: 0, paint: { type: 'GRADIENT_RADIAL' } },
      { operation: 'append', paint: { type: 'IMAGE', image_hash: 'missing' } },
      { operation: 'append', index: 0, paint: { type: 'SOLID', color: '#FFFFFF' } }
    ])
      expect(() => setPaint.execute(figma, { id: frame.id, target: 'fills', ...args })).toThrow()
    expect(frame.fills).toEqual(before)
  } finally {
    editor.dispose()
  }
})

test('removing and replacing paints keeps remaining color bindings attached and undo restores them', () => {
  const editor = createEditor()
  try {
    const figma = new FigmaAPI(editor.graph)
    const frame = figma.createFrame()
    const collection = editor.graph.createCollection('Colors')
    const red = editor.graph.createVariable('Red', 'COLOR', collection.id, {
      r: 1,
      g: 0,
      b: 0,
      a: 1
    })
    const green = editor.graph.createVariable('Green', 'COLOR', collection.id, {
      r: 0,
      g: 1,
      b: 0,
      a: 1
    })
    frame.fills = [
      { type: 'SOLID', color: { r: 1, g: 0, b: 0, a: 1 }, opacity: 1, visible: true },
      { type: 'SOLID', color: { r: 0, g: 1, b: 0, a: 1 }, opacity: 1, visible: true }
    ]
    editor.graph.bindVariable(frame.id, 'fills/0/color', red.id)
    editor.graph.bindVariable(frame.id, 'fills/1/color', green.id)
    const before = structuredClone(editor.graph.getNode(frame.id)?.boundVariables)
    executeAtomicTool(editor, figma, setPaint, {
      id: frame.id,
      target: 'fills',
      operation: 'remove',
      index: 0
    })
    expect(editor.graph.getNode(frame.id)?.boundVariables).toEqual({ 'fills/0/color': green.id })
    expect(frame.fills[0].color).toEqual({ r: 0, g: 1, b: 0, a: 1 })
    editor.undoAction()
    expect(editor.graph.getNode(frame.id)?.boundVariables).toEqual(before)
    executeAtomicTool(editor, figma, setPaint, {
      id: frame.id,
      target: 'fills',
      operation: 'replace',
      index: 1,
      paint: { type: 'SOLID', color: '#0000FF' }
    })
    expect(editor.graph.getNode(frame.id)?.boundVariables).toEqual({ 'fills/0/color': red.id })
    expect(frame.fills[1].color.b).toBe(1)
  } finally {
    editor.dispose()
  }
})

test('new creation tools are discoverable by both AI and MCP adapters', () => {
  for (const name of [
    'get_component_properties',
    'create_component_property',
    'bind_component_property',
    'edit_component_property',
    'delete_component_property',
    'set_instance_properties',
    'create_component_slot',
    'configure_component_slot',
    'reset_instance_slot',
    'set_paint'
  ]) {
    const definition = ALL_TOOLS.find((candidate) => candidate.name === name)
    expect(definition).toBeDefined()
    if (!definition) throw new Error(`Missing ${name}`)
    expect(isToolExposed(definition, 'ai')).toBe(true)
    expect(isToolExposed(definition, 'mcp')).toBe(true)
  }
})
