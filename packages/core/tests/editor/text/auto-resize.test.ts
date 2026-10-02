import { afterEach, describe, expect, test } from 'bun:test'

import { getNodeOrThrow } from '#core-tests/helpers/assert'
import { autoFrame, rect } from '#core-tests/helpers/layout'

import { createEditor } from '@open-pencil/core/editor'
import { computeAllLayouts, setTextMeasurer } from '@open-pencil/core/layout'

afterEach(() => {
  setTextMeasurer(null)
})

describe('editor text auto-resize updates', () => {
  test('live text edits resize nested Hug frames and reposition siblings in both directions', () => {
    setTextMeasurer((node) => ({ width: node.text.length * 10, height: 20 }))
    const editor = createEditor()
    const outer = autoFrame(editor.graph, editor.state.currentPageId, {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 8,
      paddingLeft: 12,
      paddingRight: 12
    })
    const inner = autoFrame(editor.graph, outer.id, {
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG'
    })
    const text = editor.graph.createNode('TEXT', inner.id, {
      text: 'Hello',
      textAutoResize: 'WIDTH_AND_HEIGHT'
    })
    const sibling = rect(editor.graph, outer.id, 30, 20)
    computeAllLayouts(editor.graph, outer.id)

    for (const content of ['Hello World', 'Hi']) {
      editor.updateTextEditNode(text.id, { text: content })

      const width = content.length * 10
      expect(text.width).toBe(width)
      expect(inner.width).toBe(width)
      expect(outer.width).toBe(width + 62)
      expect(sibling.x).toBe(width + 20)
      expect(editor.undo.canUndo).toBe(false)
    }
    editor.dispose()
  })

  test('live line breaks resize auto-height text and its Hug parent', () => {
    setTextMeasurer((node) => ({
      width: node.width,
      height: node.text.split('\n').length * 20
    }))
    const editor = createEditor()
    const frame = autoFrame(editor.graph, editor.state.currentPageId, {
      layoutMode: 'VERTICAL',
      primaryAxisSizing: 'HUG',
      counterAxisSizing: 'HUG',
      itemSpacing: 8,
      paddingTop: 10,
      paddingBottom: 10
    })
    const text = editor.graph.createNode('TEXT', frame.id, {
      text: 'Hello',
      textAutoResize: 'HEIGHT',
      width: 120
    })
    const sibling = rect(editor.graph, frame.id, 30, 20)
    computeAllLayouts(editor.graph, frame.id)

    for (const content of ['Hello\n\n', 'Hello']) {
      editor.updateTextEditNode(text.id, { text: content })

      const height = content.split('\n').length * 20
      expect(text.width).toBe(120)
      expect(text.height).toBe(height)
      expect(frame.height).toBe(height + 48)
      expect(sibling.y).toBe(height + 18)
    }
    editor.dispose()
  })

  test('lineHeight changes resize auto-height text', () => {
    setTextMeasurer((node) => ({ width: node.width, height: node.lineHeight ?? 20 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      textAutoResize: 'HEIGHT',
      width: 120,
      height: 20,
      lineHeight: 20
    })

    editor.updateNode(text.id, { lineHeight: 48 })

    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toBe(48)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
  })

  test('lineHeight changes on auto-height text are undoable with height', () => {
    setTextMeasurer((node) => ({ width: node.width, height: node.lineHeight ?? 20 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Hello',
      textAutoResize: 'HEIGHT',
      width: 120,
      height: 20,
      lineHeight: 20
    })

    editor.updateNodeWithUndo(text.id, { lineHeight: 48 }, 'Change lineHeight')

    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
    editor.undo.undo()
    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toBe(20)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(20)
    editor.undo.redo()
    expect(getNodeOrThrow(editor.graph, text.id).lineHeight).toBe(48)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(48)
  })

  test('direct edits drop stale path glyphs without paragraph auto-resize', () => {
    // A mutation outside the font-gated canvas edit session cannot reflow the
    // glyphs. It must clear stale outlines/path identity without applying
    // paragraph auto-resize to the imported path-text box.
    setTextMeasurer((node) => ({ width: node.width, height: node.lineHeight ?? 20 }))

    const editor = createEditor()
    const glyphs = [
      { commandsBlob: new Uint8Array([1, 0, 0, 0, 0]), x: 0, y: 0, fontSize: 80 },
      { commandsBlob: new Uint8Array([1, 0, 0, 0, 0]), x: 40, y: 5, fontSize: 80 }
    ]
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'ab',
      textAutoResize: 'HEIGHT',
      width: 200,
      height: 200,
      fontFamily: 'NoSuchFont',
      fontSize: 80,
      textPathData: {
        network: {
          vertices: [
            { x: 0, y: 100 },
            { x: 200, y: 100 }
          ],
          segments: [
            { start: 0, end: 1, tangentStart: { x: 0, y: 0 }, tangentEnd: { x: 0, y: 0 } }
          ],
          regions: []
        },
        normalizedSize: { x: 200, y: 200 },
        tValue: 0,
        forward: true
      },
      textPathBox: { x: 0, y: 0, width: 200, height: 200 },
      derivedTextGlyphs: glyphs
    })

    editor.updateNode(text.id, { text: 'abc' })

    const updated = getNodeOrThrow(editor.graph, text.id)
    expect(updated.derivedTextGlyphs).toBeNull()
    expect(updated.textPathData).toBeNull()
    expect(updated.height).toBe(200)
  })

  test('font size changes resize width-and-height text', () => {
    setTextMeasurer((node) => ({ width: node.fontSize * 4, height: node.fontSize * 2 }))

    const editor = createEditor()
    const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
      text: 'Text',
      textAutoResize: 'WIDTH_AND_HEIGHT',
      width: 40,
      height: 20,
      fontSize: 10
    })

    editor.updateNode(text.id, { fontSize: 16 })

    expect(getNodeOrThrow(editor.graph, text.id).width).toBe(64)
    expect(getNodeOrThrow(editor.graph, text.id).height).toBe(32)
  })
})
