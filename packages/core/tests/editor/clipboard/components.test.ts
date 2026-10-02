import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { buildOpenPencilClipboardHTML } from '@open-pencil/core/clipboard'
import { createEditor } from '@open-pencil/core/editor'

for (const delivery of ['snapshot', 'legacy-html'] as const) {
  test(`${delivery}: copying a definition pastes a linked instance outside itself, with one-step undo`, async () => {
    const editor = createEditor()
    try {
      const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId, {
        name: 'Button',
        x: 100,
        y: 100,
        width: 100,
        height: 50,
        cornerSmoothing: 0.8
      })
      const child = editor.graph.createNode('RECTANGLE', component.id, { x: 12, y: 13 })
      editor.select([component.id])
      const payload = await editor.prepareCopy()
      const before = new Set(editor.graph.nodes.keys())
      if (delivery === 'snapshot') await editor.pasteSnapshot(expectDefined(payload.snapshot))
      else await editor.pasteFromHTML(buildOpenPencilClipboardHTML([component], editor.graph))
      const instance = expectDefined(editor.graph.getNode([...editor.state.selectedIds][0]))
      expect(instance).toMatchObject({
        type: 'INSTANCE',
        componentId: component.id,
        parentId: component.parentId,
        cornerSmoothing: 0.8
      })
      expect(component.childIds).toEqual([child.id])
      expect(editor.graph.getChildren(instance.id)[0]).toMatchObject({
        componentId: child.id,
        x: 12,
        y: 13
      })
      expect([...editor.graph.nodes.values()].filter((n) => n.type === 'COMPONENT')).toHaveLength(1)
      editor.undoAction()
      expect(new Set(editor.graph.nodes.keys())).toEqual(before)
      editor.redoAction()
      expect(editor.graph.getNode(instance.id)?.componentId).toBe(component.id)
    } finally {
      editor.dispose()
    }
  })
}

test('pasting a definition or a copied instance cannot create a transitive dependency cycle', async () => {
  const editor = createEditor()
  try {
    const page = editor.state.currentPageId
    const outer = editor.graph.createNode('FRAME', page)
    const a = editor.graph.createNode('COMPONENT', outer.id)
    const b = editor.graph.createNode('COMPONENT', outer.id)
    editor.graph.createInstance(b.id, a.id)
    const instance = expectDefined(editor.graph.createInstance(a.id, page))
    const inner = editor.graph.createNode('FRAME', b.id)
    for (const source of [a, instance]) {
      editor.select([source.id])
      const payload = await editor.prepareCopy()
      editor.select([inner.id])
      await editor.pasteSnapshot(expectDefined(payload.snapshot))
      const pasted = expectDefined(editor.graph.getNode([...editor.state.selectedIds][0]))
      expect(pasted).toMatchObject({ type: 'INSTANCE', componentId: a.id, parentId: outer.id })
      expect(inner.childIds).toEqual([])
    }
  } finally {
    editor.dispose()
  }
})

test('Paste to replace preserves a definition needed by the pasted instance', async () => {
  const editor = createEditor()
  try {
    const component = editor.graph.createNode('COMPONENT', editor.state.currentPageId)
    editor.select([component.id])
    const payload = await editor.prepareCopy()
    await editor.pasteSnapshot(expectDefined(payload.snapshot), undefined, {
      replaceSelection: true
    })
    const pasted = expectDefined(editor.graph.getNode([...editor.state.selectedIds][0]))
    expect(pasted).toMatchObject({ type: 'INSTANCE', componentId: component.id })
    expect(editor.graph.getNode(component.id)?.type).toBe('COMPONENT')
    editor.undoAction()
    expect(editor.graph.getNode(pasted.id)).toBeUndefined()
    expect(editor.graph.getNode(component.id)?.type).toBe('COMPONENT')
  } finally {
    editor.dispose()
  }
})

for (const delivery of ['snapshot', 'legacy-html', 'figma-html'] as const) {
  test(`${delivery}: foreign definitions are imported as dependencies of pasted instances and undone together`, async () => {
    const source = createEditor()
    const target = createEditor()
    try {
      const component = source.graph.createNode('COMPONENT', source.state.currentPageId, {
        name: 'Button',
        cornerRadius: 20,
        cornerSmoothing: 0.8
      })
      source.graph.createNode('RECTANGLE', component.id, { x: 12, y: 13 })
      source.select([component.id])
      const payload = await source.prepareCopy()
      const frame = target.graph.createNode('FRAME', target.state.currentPageId, {
        width: 400,
        height: 400
      })
      target.select([frame.id])
      const before = new Set(target.graph.nodes.keys())
      if (delivery === 'snapshot') await target.pasteSnapshot(expectDefined(payload.snapshot))
      else
        await target.pasteFromHTML(
          delivery === 'figma-html'
            ? payload.html
            : buildOpenPencilClipboardHTML([component], source.graph)
        )
      const instance = expectDefined(target.graph.getNode([...target.state.selectedIds][0]))
      expect(instance).toMatchObject({ type: 'INSTANCE', parentId: frame.id })
      expect(instance.cornerSmoothing).toBeCloseTo(0.8)
      const definition = expectDefined(target.graph.getNode(instance.componentId ?? ''))
      expect(definition.type).toBe('COMPONENT')
      expect(definition.parentId).not.toBe(frame.id)
      expect(target.graph.getChildren(instance.id)[0]).toMatchObject({ x: 12, y: 13 })
      target.undoAction()
      expect(new Set(target.graph.nodes.keys())).toEqual(before)
      target.redoAction()
      expect(target.graph.getNode(instance.id)?.componentId).toBe(definition.id)
      expect(target.graph.getNode(definition.id)?.type).toBe('COMPONENT')
    } finally {
      source.dispose()
      target.dispose()
    }
  })
}
