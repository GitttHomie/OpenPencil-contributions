import { describe, expect, test } from 'bun:test'

import { nodeChangeToProps, sceneNodeToKiwi } from '#fig/node-change/index'
import { TEXT_LAYOUT_PLUGIN_KEY } from '#fig/node-change/plugin-data'

import type { NodeChange } from '@open-pencil/kiwi/fig/codec'
import { SceneGraph } from '@open-pencil/scene-graph'

function savedText(lineHeight: number | null = null) {
  const graph = new SceneGraph()
  const node = graph.createNode('TEXT', graph.getPages()[0].id, {
    text: 'Wrap this text\nand align it',
    width: 120,
    height: 160,
    fontSize: 24,
    lineHeight,
    textAlignHorizontal: 'CENTER',
    textAlignVertical: 'BOTTOM'
  })
  const blobs: Uint8Array[] = []
  const [change] = sceneNodeToKiwi(
    node,
    { sessionID: 1, localID: 1 },
    0,
    { value: 2 },
    graph,
    blobs,
    {
      fontDigestMap: new Map(),
      runtime: {
        getGlyphOutlineMetrics: () => [
          {
            commands: [{ type: 'M', x: 0, y: 0 }, { type: 'L', x: 8, y: 16 }, { type: 'Z' }],
            x: 0,
            advance: 10
          }
        ]
      }
    }
  )
  return { change, blobs }
}

function legacy(change: NodeChange): NodeChange {
  return {
    ...change,
    pluginData: change.pluginData?.filter((entry) => entry.key !== TEXT_LAYOUT_PLUGIN_KEY)
  }
}

describe('native paragraph layout on reopen', () => {
  for (const lineHeight of [null, 38.5]) {
    test(`keeps authored line height ${lineHeight} and discards approximate glyph placement`, () => {
      const { change, blobs } = savedText(lineHeight)
      expect(change.derivedTextData?.glyphs).toHaveLength(1)
      expect(nodeChangeToProps(change, blobs)).toMatchObject({
        lineHeight,
        derivedTextGlyphs: [],
        derivedLayout: { width: 120, height: 160 },
        textAlignHorizontal: 'CENTER',
        textAlignVertical: 'BOTTOM'
      })
    })

    test(`repairs the legacy generated fallback with line height ${lineHeight}`, () => {
      const { change, blobs } = savedText(lineHeight)
      expect(nodeChangeToProps(legacy(change), blobs)).toMatchObject({
        lineHeight,
        derivedTextGlyphs: []
      })
    })
  }

  test('retains imported outlines without native ownership', () => {
    const { change, blobs } = savedText()
    expect(nodeChangeToProps({ ...change, pluginData: [] }, blobs).derivedTextGlyphs).toHaveLength(
      1
    )
  })

  test('retains genuine glyph positioning in imported text re-saved by OpenPencil', () => {
    const { change, blobs } = savedText()
    const imported = legacy(change)
    const glyph = imported.derivedTextData?.glyphs?.[0]
    if (!glyph) throw new Error('Missing glyph fixture')
    glyph.position.y = 23
    expect(nodeChangeToProps(imported, blobs).derivedTextGlyphs).toHaveLength(1)
  })

  test('does not infer legacy provenance from ownership and a single baseline alone', () => {
    const { change, blobs } = savedText()
    const imported = legacy(change)
    const derived = imported.derivedTextData
    if (!derived) throw new Error('Missing derived fixture')
    derived.logicalIndexToCharacterOffsetMap = [0, 16, 28]
    expect(nodeChangeToProps(imported, blobs).derivedTextGlyphs).toHaveLength(1)
  })

  test('keeps path text authoritative even when a paragraph marker is present', () => {
    const { change, blobs } = savedText()
    expect(
      nodeChangeToProps({ ...change, type: 'TEXT_PATH' }, blobs).derivedTextGlyphs
    ).toHaveLength(1)
  })
})
