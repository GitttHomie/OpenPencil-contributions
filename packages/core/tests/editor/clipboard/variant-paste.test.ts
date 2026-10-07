import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { buildOpenPencilClipboardHTML } from '@open-pencil/core/clipboard'
import { createEditor } from '@open-pencil/core/editor'

import { getComponentSetVariantConflicts } from '#core/editor/components/variants/model'

for (const delivery of ['snapshot', 'legacy-html', 'figma-html'] as const) {
  test(`${delivery}: paste into a component set creates a variant using first ordered values and undoes completely`, async () => {
    const editor = createEditor()
    try {
      const set = editor.graph.createNode('COMPONENT_SET', editor.state.currentPageId, {
        name: 'Button',
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG',
        componentPropertyDefinitions: [
          {
            id: 'state',
            name: 'State',
            type: 'VARIANT',
            defaultValue: 'Hover',
            variantOptions: ['Base', 'Hover']
          },
          {
            id: 'size',
            name: 'Size',
            type: 'VARIANT',
            defaultValue: 'Large',
            variantOptions: ['Small', 'Large']
          }
        ]
      })
      const base = editor.graph.createNode('COMPONENT', set.id, {
        name: 'State=Base, Size=Small',
        width: 80,
        height: 30,
        componentPropertyValues: { State: 'Base', Size: 'Small' }
      })
      const hover = editor.graph.createNode('COMPONENT', set.id, {
        name: 'State=Hover, Size=Large',
        width: 100,
        height: 40,
        componentPropertyValues: { State: 'Hover', Size: 'Large' },
        cornerSmoothing: 0.8
      })
      editor.graph.createNode('TEXT', hover.id, { name: 'Caption', text: 'Copied label' })
      const instance = expectDefined(
        editor.graph.createInstance(hover.id, editor.state.currentPageId)
      )
      editor.select([hover.id])
      const payload = await editor.prepareCopy()
      editor.select([set.id])
      const before = new Set(editor.graph.nodes.keys())
      const definitions = structuredClone(set.componentPropertyDefinitions)
      if (delivery === 'snapshot') await editor.pasteSnapshot(expectDefined(payload.snapshot))
      else
        await editor.pasteFromHTML(
          delivery === 'figma-html'
            ? payload.html
            : buildOpenPencilClipboardHTML([hover], editor.graph)
        )
      const pasted = expectDefined(editor.graph.getNode([...editor.state.selectedIds][0]))
      expect(pasted).toMatchObject({
        type: 'COMPONENT',
        parentId: set.id,
        componentPropertyValues: { State: 'Base', Size: 'Small' }
      })
      expect(pasted.cornerSmoothing).toBeCloseTo(0.8)
      expect(editor.graph.getChildren(pasted.id)[0]?.text).toBe('Copied label')
      expect(pasted.name).toContain('State=Base')
      expect(pasted.name).toContain('Size=Small')
      expect(getComponentSetVariantConflicts(editor.graph, set.id)[0]?.componentIds).toEqual([
        base.id,
        pasted.id
      ])
      expect(instance.componentId).toBe(hover.id)
      expect(set.componentPropertyDefinitions).toEqual(definitions)
      editor.undoAction()
      expect(new Set(editor.graph.nodes.keys())).toEqual(before)
      editor.redoAction()
      expect(editor.graph.getNode(pasted.id)?.type).toBe('COMPONENT')
      expect(editor.graph.getNode(pasted.id)?.componentPropertyValues).toEqual({
        State: 'Base',
        Size: 'Small'
      })
    } finally {
      editor.dispose()
    }
  })
}

test('pasting while the copied variant stays selected uses its set and the current value order', async () => {
  const editor = createEditor()
  try {
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
      name: 'Button'
    })
    const copyId = expectDefined(editor.addVariant(component.id))
    const set = expectDefined(editor.graph.getNode(component.parentId ?? ''))
    const definition = expectDefined(
      set.componentPropertyDefinitions.find((property) => property.type === 'VARIANT')
    )
    editor.select([component.id])
    const payload = await editor.prepareCopy()
    editor.graph.updateNode(set.id, {
      componentPropertyDefinitions: set.componentPropertyDefinitions.map((property) =>
        property.id === definition.id
          ? { ...property, variantOptions: ['Variant 2', 'Default'] }
          : property
      )
    })
    await editor.pasteSnapshot(expectDefined(payload.snapshot))
    const pasted = expectDefined(editor.graph.getNode([...editor.state.selectedIds][0]))
    expect(pasted.type).toBe('COMPONENT')
    expect(pasted.parentId).toBe(set.id)
    expect(pasted.componentPropertyValues[definition.name]).toBe('Variant 2')
    expect(set.childIds).toEqual([component.id, copyId, pasted.id])
    expect(component.childIds).toEqual([])
  } finally {
    editor.dispose()
  }
})
