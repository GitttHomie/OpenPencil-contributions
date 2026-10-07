import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'
import { computeAllLayouts } from '@open-pencil/core/layout'
import type { SceneGraph } from '@open-pencil/scene-graph'

async function savedCard(nested: boolean) {
  const editor = createEditor()
  const graph = editor.graph
  const component = graph.createNode('COMPONENT', editor.state.currentPageId, {
    name: 'Card',
    width: 320,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    paddingTop: 12,
    paddingBottom: 12
  })
  const content = graph.createNode('FRAME', component.id, {
    name: 'Content',
    width: 320,
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'FIXED',
    counterAxisSizing: 'HUG',
    layoutAlignSelf: 'STRETCH'
  })
  const items = graph.createNode('FRAME', content.id, {
    name: 'Items',
    width: 320,
    layoutMode: 'VERTICAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'FIXED',
    layoutGrow: 1,
    itemSpacing: 4
  })
  for (const height of [24, 16, 22]) {
    const item = graph.createNode('FRAME', items.id, {
      name: `Item ${height}`,
      width: 320,
      height,
      layoutAlignSelf: 'STRETCH'
    })
    if (nested && height === 24) {
      const icon = graph.createNode('COMPONENT', editor.state.currentPageId, {
        name: 'Icon',
        width: 12,
        height: 12
      })
      graph.createNode('FRAME', icon.id, { width: 12, height: 12 })
      graph.createInstance(icon.id, item.id)
    }
  }
  computeAllLayouts(graph)
  graph.createInstance(component.id, editor.state.currentPageId, { name: 'Card instance' })
  await Promise.resolve()
  const bytes = await exportFigFile(graph)
  editor.dispose()
  return parseFigFile(bytes.slice().buffer)
}

function assertSizes(graph: SceneGraph, height: number) {
  for (const name of ['Content', 'Items']) {
    const nodes = [...graph.getAllNodes()].filter((node) => node.name === name)
    expect(nodes).toHaveLength(2)
    for (const node of nodes) {
      expect(node.height).toBeCloseTo(height)
      expect(node.width).toBeCloseTo(320)
    }
  }
  for (const name of ['Card', 'Card instance']) {
    const node = expectDefined([...graph.getAllNodes()].find((node) => node.name === name))
    expect(node.height).toBeCloseTo(height + 24)
    expect(node.width).toBe(320)
  }
}

for (const format of ['snapshot', 'fig'] as const) {
  for (const nested of [false, true]) {
    test(`pasting into a reopened Fill/Hug component child refreshes its bounds and instances (${format}, nested=${nested})`, async () => {
      await initCodec()
      const graph = await savedCard(nested)
      const editor = createEditor({ graph })
      try {
        assertSizes(graph, 70)
        const component = expectDefined(
          [...graph.getAllNodes()].find((node) => node.type === 'COMPONENT' && node.name === 'Card')
        )
        const content = expectDefined(graph.getChildren(component.id)[0])
        const items = expectDefined(graph.getChildren(content.id)[0])
        const original = expectDefined(graph.getChildren(items.id)[0])
        editor.select([original.id])
        const payload = await editor.prepareCopy()
        editor.select([items.id])
        if (format === 'snapshot') await editor.pasteSnapshot(expectDefined(payload.snapshot))
        else await editor.pasteFromHTML(payload.html)
        await Promise.resolve()
        assertSizes(graph, 98)
        expect(graph.getChildren(items.id)).toHaveLength(4)

        editor.undoAction()
        await Promise.resolve()
        assertSizes(graph, 70)
        editor.redoAction()
        await Promise.resolve()
        assertSizes(graph, 98)

        const reopened = await parseFigFile((await exportFigFile(graph)).slice().buffer)
        assertSizes(reopened, 98)
      } finally {
        editor.dispose()
      }
    })
  }
}
