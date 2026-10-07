import { expect, test } from 'bun:test'

import { createEditor } from '#core/editor/create'
import { computeLayout } from '#core/layout'

for (const layoutMode of ['HORIZONTAL', 'VERTICAL'] as const) {
  for (const provenance of ['new', 'derived', 'imported']) {
    test(`visibility properties resize Fill siblings and their children (${layoutMode}, ${provenance})`, async () => {
      const axis = layoutMode === 'HORIZONTAL' ? 'width' : 'height'
      const position = layoutMode === 'HORIZONTAL' ? 'x' : 'y'
      const editor = createEditor()
      const graph = editor.graph
      const component = graph.createNode('COMPONENT', editor.state.currentPageId, {
        width: 60,
        height: 60,
        [axis]: 300,
        layoutMode,
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED',
        itemSpacing: 10
      })
      const fixed = graph.createNode('FRAME', component.id, { width: 60, height: 60, [axis]: 80 })
      const fill = graph.createNode('FRAME', component.id, {
        width: 60,
        height: 60,
        [axis]: 210,
        layoutMode,
        layoutGrow: 1,
        primaryAxisSizing: 'FIXED',
        counterAxisSizing: 'FIXED'
      })
      graph.createNode('FRAME', fill.id, { width: 60, height: 60, [axis]: 210, layoutGrow: 1 })
      computeLayout(graph, component.id)
      const property = editor.exposeComponentProperty(fixed.id, 'VISIBLE', 'Show fixed')
      if (!property) throw new Error('Expected visibility property')
      const instance = graph.createInstance(component.id, editor.state.currentPageId)
      if (!instance) throw new Error('Expected instance')
      const filling = graph.getChildren(instance.id).find((node) => node.componentId === fill.id)
      if (!filling) throw new Error('Expected filling child')
      const inner = graph.getChildren(filling.id)[0]
      if (!inner) throw new Error('Expected nested filling child')
      await Promise.resolve()
      if (provenance !== 'new') {
        for (const node of [instance, ...graph.getChildren(instance.id), inner]) {
          graph.updateNode(node.id, {
            source: {
              ...node.source,
              format: provenance === 'imported' ? 'fig' : node.source.format,
              editedFields: []
            },
            derivedLayout: { x: node.x, y: node.y, width: node.width, height: node.height }
          })
        }
      }
      editor.undo.clear()
      editor.setInstanceComponentProperty(instance.id, property, 'false')
      await Promise.resolve()
      expect(filling[axis]).toBe(300)
      expect(filling[position]).toBe(0)
      expect(inner[axis]).toBe(300)
      expect(fill[axis]).toBe(210)
      expect(fixed.visible).toBe(true)
      editor.undo.undo()
      expect(filling[axis]).toBe(210)
      expect(filling[position]).toBe(90)
      expect(inner[axis]).toBe(210)
      editor.undo.redo()
      expect(filling[axis]).toBe(300)
      expect(inner[axis]).toBe(300)
      graph.updateNode(component.id, { cornerRadius: 8 })
      await Promise.resolve()
      expect(filling[axis]).toBe(300)
      expect(inner[axis]).toBe(300)
      editor.setInstanceComponentProperty(instance.id, property, 'true')
      expect(filling[axis]).toBe(210)
      expect(inner[axis]).toBe(210)
      editor.dispose()
    })
  }
}
