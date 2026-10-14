import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { setInstanceOverride } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor/create'
import { exportFigFile, parseFigFile } from '#core/io'
import { initCodec } from '#core/kiwi'
import { computeAllLayouts } from '#core/layout'

test.each(['HORIZONTAL', 'VERTICAL'] as const)(
  '%s: a reopened Fill instance distributes its allocated size to Fill contents',
  async (direction) => {
    const editor = createEditor()
    try {
      const graph = editor.graph
      const horizontal = direction === 'HORIZONTAL'
      const size = horizontal ? { width: 390, height: 88 } : { width: 88, height: 390 }
      const main = graph.createNode('COMPONENT', editor.state.currentPageId, {
        name: 'Navigation',
        ...size,
        layoutMode: direction,
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        fills: [
          { type: 'SOLID', color: { r: 0.1, g: 0.1, b: 0.1, a: 1 }, opacity: 1, visible: true }
        ],
        paddingLeft: horizontal ? 8 : 0,
        paddingRight: horizontal ? 8 : 0,
        paddingTop: horizontal ? 0 : 8,
        paddingBottom: horizontal ? 0 : 8
      })
      for (const length of [30, 28, 45, 28]) {
        const tab = graph.createNode('FRAME', main.id, {
          name: 'Tab',
          width: horizontal ? 93.5 : 88,
          height: horizontal ? 88 : 93.5,
          layoutMode: horizontal ? 'VERTICAL' : 'HORIZONTAL',
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'HUG',
          layoutGrow: 1,
          layoutAlignSelf: 'STRETCH'
        })
        graph.createNode('FRAME', tab.id, {
          width: horizontal ? length : 24,
          height: horizontal ? 24 : length
        })
      }
      const screen = graph.createNode('FRAME', editor.state.currentPageId, {
        name: 'Screen',
        ...size,
        layoutMode: horizontal ? 'VERTICAL' : 'HORIZONTAL',
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED'
      })
      const instance = expectDefined(graph.createInstance(main.id, screen.id))
      setInstanceOverride(
        instance.instanceOverrides,
        instance.id,
        instance.id,
        'primaryAxisSizing',
        'HUG'
      )
      graph.updateNode(instance.id, {
        primaryAxisSizing: 'HUG',
        layoutAlignSelf: 'STRETCH',
        derivedLayout: size,
        instanceOverrides: instance.instanceOverrides
      })
      await initCodec()
      const restored = await parseFigFile((await exportFigFile(graph)).slice().buffer)
      const saved = expectDefined(
        Array.from(restored.getAllNodes()).find((node) => node.type === 'INSTANCE')
      )
      const axis = horizontal ? 'width' : 'height'
      expect(saved.primaryAxisSizing).toBe('HUG')
      for (let pass = 0; pass < 2; pass++) {
        computeAllLayouts(restored)
        expect(saved[axis]).toBe(390)
        expect(restored.getChildren(saved.id).map((node) => node[axis])).toEqual([
          93.5, 93.5, 93.5, 93.5
        ])
      }
      expect(saved.primaryAxisSizing).toBe('HUG')
      expect(saved.layoutAlignSelf).toBe('STRETCH')
      expect(main.primaryAxisSizing).toBe('FIXED')
      const reopened = createEditor({ graph: restored })
      try {
        const parent = expectDefined(restored.getNode(saved.parentId ?? ''))
        reopened.updateNodeWithUndo(parent.id, { [axis]: 470 })
        expect(restored.getChildren(saved.id).map((node) => node[axis])).toEqual([
          113.5, 113.5, 113.5, 113.5
        ])
        reopened.undo.undo()
        expect(restored.getChildren(saved.id).map((node) => node[axis])).toEqual([
          93.5, 93.5, 93.5, 93.5
        ])
      } finally {
        reopened.dispose()
      }
    } finally {
      editor.dispose()
    }
  }
)
