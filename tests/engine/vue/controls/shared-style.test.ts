import { describe, expect, test } from 'bun:test'

import { createEditor } from '@open-pencil/core/editor'
import { effectiveFigmaRawNodeFields } from '@open-pencil/fig'
import { getSharedStyles, type Effect, type Fill, type SceneNode } from '@open-pencil/scene-graph'

import { sharedStyleDetachPatch, sharedStylePatch } from '#vue/controls/shared-style/model'

import { firstPageId, makeSceneGraph } from '#tests/helpers/scene'

const red: Fill = {
  type: 'SOLID',
  color: { r: 1, g: 0, b: 0, a: 1 },
  opacity: 1,
  visible: true
}
const blue: Fill = {
  type: 'SOLID',
  color: { r: 0, g: 0.3, b: 1, a: 1 },
  opacity: 1,
  visible: true
}

function setSourceId(node: SceneNode, id: string) {
  node.source.id = id
  node.source.format = 'fig'
}

describe('shared style model', () => {
  test('lists internal definitions and applies canonical domain properties', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const fillStyle = graph.createNode('RECTANGLE', pageId, {
      name: 'Brand/Primary',
      fills: [red],
      sharedStyleType: 'FILL',
      internalOnly: true
    })
    setSourceId(fillStyle, '1:20')
    const target = graph.createNode('RECTANGLE', pageId, { fills: [blue] })

    expect(getSharedStyles(graph, 'fill')).toEqual([
      { id: '1:20', nodeId: fillStyle.id, name: 'Brand/Primary', type: 'FILL' }
    ])
    expect(sharedStylePatch('fill', target, '1:20', fillStyle)).toMatchObject({
      fillStyleId: '1:20',
      fills: [red]
    })
    expect(sharedStyleDetachPatch('fill')).toEqual({ fillStyleId: null })
  })

  test('applies text, effect, and grid style payloads', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const target = graph.createNode('TEXT', pageId)
    const textStyle = graph.createNode('TEXT', pageId, {
      fontFamily: 'Inter',
      fontSize: 24,
      fontWeight: 700,
      lineHeight: 32,
      textCase: 'UPPER'
    })
    const effect: Effect = {
      type: 'DROP_SHADOW',
      color: { r: 0, g: 0, b: 0, a: 0.25 },
      offset: { x: 0, y: 4 },
      radius: 8,
      spread: 0,
      visible: true
    }
    const effectStyle = graph.createNode('RECTANGLE', pageId, { effects: [effect] })
    const gridStyle = graph.createNode('FRAME', pageId, {
      layoutGrids: [{ pattern: 'COLUMNS', count: 12, gutterSize: 16, visible: true }]
    })

    expect(sharedStylePatch('text', target, '1:21', textStyle)).toMatchObject({
      textStyleId: '1:21',
      fontSize: 24,
      fontWeight: 700,
      lineHeight: 32,
      textCase: 'UPPER'
    })
    expect(sharedStylePatch('effect', target, '1:22', effectStyle)).toMatchObject({
      effectStyleId: '1:22',
      effects: [effect]
    })
    expect(sharedStylePatch('grid', target, '1:23', gridStyle)).toMatchObject({
      gridStyleId: '1:23',
      layoutGrids: [{ count: 12 }]
    })
  })

  test('switching text styles replaces their variable bindings and restores them on undo', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const collection = graph.createCollection('Typography')
    const oldSize = graph.createVariable('Display size', 'FLOAT', collection.id, 48)
    const newSize = graph.createVariable('Heading size', 'FLOAT', collection.id, 24)
    const newHeight = graph.createVariable('Heading height', 'FLOAT', collection.id, 32)
    const target = graph.createNode('TEXT', pageId, {
      text: 'A heading',
      fontSize: 48,
      lineHeight: 56,
      textStyleId: '1:20',
      boundVariables: { fontSize: oldSize.id, fontStyle: 'old-weight', opacity: 'opacity-token' },
      variableBindingScales: { fontSize: 2, opacity: 0.01 }
    })
    const style = graph.createNode('TEXT', pageId, {
      fontSize: 24,
      lineHeight: 32,
      boundVariables: { fontSize: newSize.id, lineHeight: newHeight.id, opacity: 'style-opacity' },
      variableBindingScales: { fontSize: 1, lineHeight: 1, opacity: 0.5 }
    })
    const editor = createEditor({ graph })
    const before = structuredClone({
      textStyleId: target.textStyleId,
      fontSize: target.fontSize,
      lineHeight: target.lineHeight,
      boundVariables: target.boundVariables,
      variableBindingScales: target.variableBindingScales
    })
    editor.updateNodeWithUndo(target.id, sharedStylePatch('text', target, '1:21', style))
    expect(target).toMatchObject({
      textStyleId: '1:21',
      fontSize: 24,
      lineHeight: 32,
      boundVariables: {
        fontSize: newSize.id,
        lineHeight: newHeight.id,
        opacity: 'opacity-token'
      },
      variableBindingScales: { fontSize: 1, lineHeight: 1, opacity: 0.01 }
    })
    expect(target.boundVariables.fontStyle).toBeUndefined()
    expect(graph.resolveNumberVariableForNode(target.id, target.boundVariables.fontSize)).toBe(24)
    editor.undo.undo()
    expect(target).toMatchObject(before)
    editor.undo.redo()
    expect(target.boundVariables.fontSize).toBe(newSize.id)
    expect(style.boundVariables.opacity).toBe('style-opacity')
  })

  test('a literal text style removes old typography bindings but keeps other bindings', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const target = graph.createNode('TEXT', pageId, {
      boundVariables: { fontSize: 'old-size', fontFamily: 'old-font', text: 'caption' },
      variableBindingScales: { fontSize: 2, width: 1 }
    })
    const style = graph.createNode('TEXT', pageId, {
      fontSize: 16,
      fontFeatures: [{ tag: 'LIGA', enabled: false }]
    })
    const patch = sharedStylePatch('text', target, '1:21', style)
    expect(patch.boundVariables).toEqual({ text: 'caption' })
    expect(patch.variableBindingScales).toEqual({ width: 1 })
    expect(patch.fontFeatures).toEqual(style.fontFeatures)
    expect(patch.fontFeatures).not.toBe(style.fontFeatures)
  })

  test('detaching a reference invalidates only its effective Figma fallback', () => {
    const graph = makeSceneGraph()
    const target = graph.createNode('RECTANGLE', firstPageId(graph), {
      fillStyleId: '1:20',
      effectStyleId: '1:22'
    })
    target.source.fig.rawNodeFields = {
      styleIdForFill: { guid: { sessionID: 1, localID: 20 } },
      styleIdForEffect: { guid: { sessionID: 1, localID: 22 } },
      description: 'Preserve me'
    }

    graph.updateNode(target.id, { fillStyleId: null })

    expect(target.source.fig.rawNodeFields).toHaveProperty('styleIdForFill')
    expect(effectiveFigmaRawNodeFields(target)).toEqual({
      styleIdForEffect: { guid: { sessionID: 1, localID: 22 } },
      description: 'Preserve me'
    })
  })

  test('manual paint edits detach while typography edits retain the style for updating', () => {
    const graph = makeSceneGraph()
    const pageId = firstPageId(graph)
    const target = graph.createNode('RECTANGLE', pageId, {
      fills: [red],
      fillStyleId: '1:20',
      effectStyleId: '1:22'
    })
    const editor = createEditor({ graph })

    editor.updateNodeWithUndo(target.id, { fills: [blue] }, 'Change fills')
    expect(graph.getNode(target.id)).toMatchObject({
      fillStyleId: null,
      effectStyleId: '1:22',
      fills: [blue]
    })

    editor.undo.undo()
    expect(graph.getNode(target.id)).toMatchObject({ fillStyleId: '1:20', fills: [red] })

    const text = graph.createNode('TEXT', pageId, { fontSize: 16, textStyleId: '1:21' })
    editor.updateNodeWithUndo(text.id, { fontSize: 24 }, 'Change font size')
    expect(graph.getNode(text.id)).toMatchObject({ fontSize: 24, textStyleId: '1:21' })
    editor.undo.undo()
    expect(graph.getNode(text.id)).toMatchObject({ fontSize: 16, textStyleId: '1:21' })
  })
})
