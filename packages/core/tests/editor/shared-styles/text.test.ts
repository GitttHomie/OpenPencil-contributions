import { expect, test } from 'bun:test'

import {
  getSharedStyles,
  SceneGraph,
  textStyleApplication,
  textStyleMatches
} from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor'
import { exportFigFile, parseFigFile } from '#core/io/formats/fig'

test('create, locally modify, and update a text style across pages with one undo step', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const other = graph.createNode('CANVAS', graph.rootId, { name: 'Other page' })
  const source = graph.createNode('TEXT', page.id, { text: 'First', fontSize: 16 })
  const follower = graph.createNode('TEXT', other.id, { text: 'Second', fontSize: 16 })
  const untouched = graph.createNode('TEXT', page.id, { text: 'Unrelated', fontSize: 12 })
  const editor = createEditor({ graph, loadFont: async () => null })
  editor.select([source.id])
  const styleId = editor.createTextStyle(source.id, 'Body / Default')
  const found = getSharedStyles(graph, 'text').find((style) => style.id === styleId)
  const style = found && graph.getNode(found.nodeId)
  if (!style) throw new Error('Missing style')
  expect(style.internalOnly).toBe(true)
  expect(style.text).toBe('')
  graph.updateNode(follower.id, textStyleApplication(follower, style, styleId))
  editor.updateNodeWithUndo(source.id, { fontSize: 24 }, 'Change text size')
  expect(source.textStyleId).toBe(styleId)
  expect(follower.fontSize).toBe(16)
  expect(style.fontSize).toBe(16)
  expect(await editor.updateTextStyle(source.id)).toBe(2)
  expect(source.fontSize).toBe(24)
  expect(follower.fontSize).toBe(24)
  expect(style.fontSize).toBe(24)
  expect(untouched.fontSize).toBe(12)
  expect(editor.state.currentPageId).toBe(page.id)
  editor.undo.undo()
  expect(style.fontSize).toBe(16)
  expect(follower.fontSize).toBe(16)
  expect(source.fontSize).toBe(24)
  editor.undo.redo()
  expect(follower.fontSize).toBe(24)
  editor.dispose()
})

test('styles retain variable bindings and unused definitions across save and reopen', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const collection = graph.createCollection('Type')
  const size = graph.createVariable('Body size', 'FLOAT', collection.id, 18)
  const source = graph.createNode('TEXT', page.id, {
    text: 'A sample',
    fontSize: 18,
    boundVariables: { fontSize: size.id }
  })
  const editor = createEditor({ graph, loadFont: async () => null })
  const styleId = editor.createTextStyle(source.id, 'Body')
  editor.updateNodeWithUndo(source.id, { textStyleId: null })
  const bytes = await exportFigFile(graph)
  const reopened = await parseFigFile(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  )
  const styles = getSharedStyles(reopened, 'text')
  expect(styles).toHaveLength(1)
  const definition = reopened.getNode(styles[0].nodeId)
  expect(definition?.name).toBe('Body')
  expect(definition?.fontSize).toBe(18)
  const binding = definition?.boundVariables.fontSize
  expect(binding && reopened.resolveNumberVariable(binding)).toBe(18)
  expect(styleId).toBeTruthy()
  editor.dispose()
})

test('style updates preserve consumer modes, range references, and component connections', async () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const collection = graph.createCollection('Type')
  graph.addMode(collection.id, 'large', 'Large')
  const size = graph.createVariable('Size', 'FLOAT', collection.id, 16)
  size.valuesByMode.large = 32
  const component = graph.createNode('COMPONENT', page.id, { name: 'Label' })
  const source = graph.createNode('TEXT', component.id, { text: 'Label', fontSize: 16 })
  const editor = createEditor({ graph, loadFont: async () => null })
  const id = editor.createTextStyle(source.id, 'Label style')
  const instance = graph.createInstance(component.id, page.id)
  if (!instance) throw new Error('Missing instance')
  const child = graph.getChildren(instance.id)[0]
  const consumer = graph.createNode('TEXT', page.id, {
    text: 'Large label',
    textStyleId: id,
    variableModes: { [collection.id]: 'large' }
  })
  const ranged = graph.createNode('TEXT', page.id, {
    text: 'One two',
    fontSize: 12,
    styleRuns: [{ start: 0, length: 3, style: { textStyleId: id, fontSize: 16 } }]
  })
  editor.updateNodeWithUndo(source.id, {
    fontSize: 16,
    boundVariables: { fontSize: size.id },
    letterSpacing: 2
  })
  await editor.updateTextStyle(source.id)
  expect(child.fontSize).toBe(16)
  expect(child.letterSpacing).toBe(2)
  expect(instance.componentId).toBe(component.id)
  expect(consumer.fontSize).toBe(32)
  expect(ranged.fontSize).toBe(12)
  expect(ranged.styleRuns[0].style).toMatchObject({
    textStyleId: id,
    fontSize: 16,
    letterSpacing: 2,
    boundVariables: { fontSize: size.id }
  })
  const info = getSharedStyles(graph, 'text')[0]
  const definition = graph.getNode(info.nodeId)
  if (!definition) throw new Error('Missing style')
  expect(textStyleMatches(consumer, definition)).toBe(true)
  editor.updateVariableValue(size.id, 'large', 36)
  expect(consumer.fontSize).toBe(36)
  expect(consumer.textStyleId).toBe(id)
  editor.dispose()
})

test('applying a whole text style clears previous character typography without removing links', () => {
  const graph = new SceneGraph()
  const page = graph.getPages()[0]
  const source = graph.createNode('TEXT', page.id, {
    text: 'Body',
    fontFamily: 'Inter',
    fontWeight: 700
  })
  const target = graph.createNode('TEXT', page.id, {
    text: 'Linked text',
    styleRuns: [
      {
        start: 0,
        length: 6,
        style: {
          fontFamily: 'Old font',
          fontWeight: 400,
          fontSize: 40,
          boundVariables: { fontFamily: 'old-family' },
          hyperlink: { type: 'URL', value: 'https://example.com' }
        }
      }
    ]
  })
  const editor = createEditor({ graph, loadFont: async () => null })
  const id = editor.createTextStyle(source.id, 'Body')
  editor.applyTextStyle(target.id, id)
  expect(target.fontFamily).toBe('Inter')
  expect(target.fontWeight).toBe(700)
  expect(target.styleRuns[0]?.style.fontFamily).toBeUndefined()
  expect(target.styleRuns[0]?.style.boundVariables?.fontFamily).toBeUndefined()
  expect(target.styleRuns[0]?.style.hyperlink).toEqual({
    type: 'URL',
    value: 'https://example.com'
  })
  editor.undo.undo()
  expect(target.styleRuns[0]?.style.fontFamily).toBe('Old font')
  editor.dispose()
})
