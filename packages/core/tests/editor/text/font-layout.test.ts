import { expect, test } from 'bun:test'

import { createEditor } from '#core/editor'
import { refreshTextLayoutForFont } from '#core/editor/text/font-layout'
import type { FontResolutionSnapshot } from '#core/text/resolver'

const mediumLoaded: FontResolutionSnapshot = {
  key: 'face:inter:medium',
  state: 'loaded',
  candidate: { id: 'local:Inter:Medium', family: 'Inter', style: 'Medium', source: 'local' }
}

test('font completion remeasures auto-sized labels and Hug parents without a history entry', () => {
  const editor = createEditor()
  const graph = editor.graph
  const frame = graph.createNode('FRAME', editor.state.currentPageId, {
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG',
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12
  })
  const text = graph.createNode('TEXT', frame.id, {
    text: 'button',
    fontFamily: 'Inter',
    fontWeight: 500,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    layoutSizingHorizontal: 'HUG',
    layoutSizingVertical: 'HUG',
    width: 87,
    height: 34
  })
  try {
    refreshTextLayoutForFont(
      {
        ...editor,
        getRenderer: () => ({ measureTextNode: () => ({ width: 75, height: 29 }) })
      },
      mediumLoaded
    )
    expect([text.width, text.height]).toEqual([75, 29])
    expect([frame.width, frame.height]).toEqual([107, 53])
    expect(editor.undo.canUndo).toBe(false)
  } finally {
    editor.dispose()
  }
})

test('completion preserves fixed widths, fixed boxes, baked imports, and newer font choices', () => {
  const editor = createEditor()
  const graph = editor.graph
  const base = {
    text: 'button',
    fontFamily: 'Inter',
    fontWeight: 500,
    textAutoResize: 'WIDTH_AND_HEIGHT' as const,
    width: 120,
    height: 60
  }
  const autoHeight = graph.createNode('TEXT', editor.state.currentPageId, {
    ...base,
    textAutoResize: 'HEIGHT'
  })
  const fixed = graph.createNode('TEXT', editor.state.currentPageId, {
    ...base,
    textAutoResize: 'NONE'
  })
  const imported = graph.createNode('TEXT', editor.state.currentPageId, {
    ...base,
    derivedLayout: { width: 120, height: 60 }
  })
  const undone = graph.createNode('TEXT', editor.state.currentPageId, {
    ...base,
    fontWeight: 400
  })
  const widths: Array<number | undefined> = []
  try {
    refreshTextLayoutForFont(
      {
        ...editor,
        getRenderer: () => ({
          measureTextNode: (_, maxWidth) => {
            widths.push(maxWidth)
            return { width: 75, height: 29 }
          }
        })
      },
      mediumLoaded
    )
    expect(widths).toEqual([120])
    expect([autoHeight.width, autoHeight.height]).toEqual([120, 29])
    for (const node of [fixed, imported, undone]) {
      expect([node.width, node.height]).toEqual([120, 60])
    }
  } finally {
    editor.dispose()
  }
})

test('unready shaping keeps provisional geometry until all required faces are loaded', () => {
  const editor = createEditor()
  const text = editor.graph.createNode('TEXT', editor.state.currentPageId, {
    text: 'button',
    fontFamily: 'Inter',
    fontWeight: 500,
    textAutoResize: 'WIDTH_AND_HEIGHT',
    width: 87,
    height: 34
  })
  try {
    refreshTextLayoutForFont(
      {
        ...editor,
        getRenderer: () => ({ measureTextNode: () => null })
      },
      mediumLoaded
    )
    expect([text.width, text.height]).toEqual([87, 34])
  } finally {
    editor.dispose()
  }
})
