import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { createEditor } from '#core/editor/create'

for (const provenance of ['new', 'derived', 'imported'] as const) {
  for (const forwarded of [false, true]) {
    test(`nested Hug variants resize through cached parents (${provenance}, ${forwarded ? 'forwarded' : 'direct'})`, async () => {
      const editor = createEditor()
      try {
        const graph = editor.graph
        const page = editor.state.currentPageId
        const small = graph.createNode('COMPONENT', page, {
          name: 'Icon',
          layoutMode: 'HORIZONTAL',
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'HUG'
        })
        graph.createNode('FRAME', small.id, { width: 24, height: 24 })
        const large = expectDefined(editor.addVariant(small.id))
        graph.updateNode(expectDefined(graph.getChildren(large)[0]).id, { width: 48, height: 48 })
        const set = expectDefined(graph.getNode(small.parentId ?? ''))
        const variant = expectDefined(
          set.componentPropertyDefinitions.find((item) => item.type === 'VARIANT')
        )
        const button = graph.createNode('COMPONENT', page, {
          layoutMode: 'HORIZONTAL',
          primaryAxisSizing: 'HUG',
          counterAxisSizing: 'HUG'
        })
        const source = expectDefined(graph.createInstance(small.id, button.id))
        editor.setNestedComponentPropertyExposure(button.id, source.id, [variant.id])
        const instance = expectDefined(graph.createInstance(button.id, page))
        await Promise.resolve()
        const nested = expectDefined(graph.getChildren(instance.id)[0])
        expect(nested.width).toBe(24)
        if (provenance !== 'new') {
          for (const node of [instance, nested]) {
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
        const control = expectDefined(
          editor.getInstanceComponentPropertyDefinitions(instance.id)[0]
        )
        const largeValue = expectDefined(graph.getNode(large)).componentPropertyValues[variant.name]
        const change = (value: string) =>
          editor.setInstanceComponentProperty(
            forwarded ? instance.id : nested.id,
            forwarded ? control.id : variant.id,
            value
          )
        change(largeValue)
        expect(nested).toMatchObject({ width: 48, height: 48 })
        expect(instance).toMatchObject({ width: 48, height: 48 })
        await Promise.resolve()
        expect(nested).toMatchObject({ width: 48, height: 48 })
        editor.undo.undo()
        expect(nested).toMatchObject({ width: 24, height: 24 })
        expect(instance).toMatchObject({ width: 24, height: 24 })
        editor.undo.redo()
        expect(nested).toMatchObject({ width: 48, height: 48 })
        change(small.componentPropertyValues[variant.name])
        expect(instance).toMatchObject({ width: 24, height: 24 })
      } finally {
        editor.dispose()
      }
    })
  }
}
