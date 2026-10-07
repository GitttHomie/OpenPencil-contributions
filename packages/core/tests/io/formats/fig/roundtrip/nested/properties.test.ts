import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'
import { nestedPropertyId } from '@open-pencil/scene-graph'

test('interleaved nested controls retain parent defaults, overrides and order after saving', async () => {
  await initCodec()
  const editor = createEditor()
  let reopened: ReturnType<typeof createEditor> | undefined
  try {
    const graph = editor.graph
    const page = editor.state.currentPageId
    const icon = graph.createNode('COMPONENT', page, { name: 'Icon', width: 24, height: 24 })
    const label = graph.createNode('TEXT', icon.id, { name: 'Caption', text: 'Icon' })
    const caption = expectDefined(editor.exposeComponentProperty(label.id, 'TEXT', 'Caption'))
    const large = expectDefined(editor.addVariant(icon.id))
    graph.updateNode(large, { width: 48, height: 48 })
    const set = expectDefined(graph.getNode(icon.parentId ?? ''))
    const variant = expectDefined(
      set.componentPropertyDefinitions.find((item) => item.type === 'VARIANT')
    )
    const parent = graph.createNode('COMPONENT', page, { name: 'Card' })
    const titleNode = graph.createNode('TEXT', parent.id, { name: 'Title', text: 'Title' })
    const title = expectDefined(editor.exposeComponentProperty(titleNode.id, 'TEXT', 'Title'))
    const nested = expectDefined(graph.createInstance(icon.id, parent.id, { name: 'Action' }))
    editor.setNestedComponentPropertyExposure(parent.id, nested.id, [caption, variant.id])
    editor.setInstanceComponentProperty(nested.id, caption, 'Parent default')
    editor.reorderExposedComponentProperties(parent.id, [
      nestedPropertyId(nested.id, variant.id),
      title,
      nestedPropertyId(nested.id, caption)
    ])
    const instance = expectDefined(graph.createInstance(parent.id, page, { name: 'Card instance' }))
    await Promise.resolve()
    const defs = editor.getInstanceComponentPropertyDefinitions(instance.id)
    editor.setInstanceComponentProperty(
      instance.id,
      defs[0].id,
      expectDefined(graph.getNode(large)).componentPropertyValues[variant.name]
    )
    expect(editor.getInstanceComponentPropertyValue(instance.id, defs[2])).toBe('Parent default')
    const liveTarget = expectDefined(
      editor.getInstanceComponentPropertyTarget(instance.id, defs[2].id)
    )
    expect(graph.getChildren(liveTarget.instance.id)[0]?.text).toBe('Parent default')
    await Promise.resolve()
    const document = await parseFigFile((await exportFigFile(graph)).slice().buffer)
    reopened = createEditor({ graph: document })
    const saved = expectDefined(
      [...document.getAllNodes()].find((node) => node.name === 'Card instance')
    )
    const controls = reopened.getInstanceComponentPropertyDefinitions(saved.id)
    expect(controls.map((item) => item.name)).toEqual([
      'Action / Variant',
      'Title',
      'Action / Caption'
    ])
    expect(reopened.getInstanceComponentPropertyValue(saved.id, controls[2])).toBe('Parent default')
    const target = expectDefined(
      reopened.getInstanceComponentPropertyTarget(saved.id, controls[0].id)
    )
    expect(target.instance.width).toBe(48)
    const sourceParent = expectDefined(
      [...document.getAllNodes()].find((node) => node.name === 'Card' && node.type === 'COMPONENT')
    )
    document.updateNode(sourceParent.id, { cornerRadius: 12 })
    await Promise.resolve()
    expect(target.instance.width).toBe(48)
    const savedSource = expectDefined(
      document.getChildren(sourceParent.id).find((node) => node.name === 'Action')
    )
    const sourceCaption = expectDefined(
      reopened
        .getInstanceComponentPropertyDefinitions(savedSource.id)
        .find((item) => item.name === 'Caption')
    )
    reopened.setInstanceComponentProperty(savedSource.id, sourceCaption.id, 'Changed after reopen')
    await Promise.resolve()
    expect(reopened.getInstanceComponentPropertyValue(saved.id, controls[2])).toBe(
      'Changed after reopen'
    )
    expect(document.getChildren(target.instance.id)[0]?.text).toBe('Changed after reopen')
  } finally {
    reopened?.dispose()
    editor.dispose()
  }
})

test('nested property choices and overrides survive repeated saves through two levels', async () => {
  await initCodec()
  const editor = createEditor()
  let reopened: ReturnType<typeof createEditor> | undefined
  try {
    const graph = editor.graph
    const page = editor.state.currentPageId
    const button = graph.createNode('COMPONENT', page, { name: 'Button' })
    const label = graph.createNode('TEXT', button.id, { name: 'Caption', text: 'Button' })
    const text = expectDefined(editor.exposeComponentProperty(label.id, 'TEXT', 'Caption'))
    const card = graph.createNode('COMPONENT', page, { name: 'Card' })
    const action = expectDefined(graph.createInstance(button.id, card.id, { name: 'Action' }))
    editor.setNestedComponentPropertyExposure(card.id, action.id, [text])
    const dialog = graph.createNode('COMPONENT', page, { name: 'Dialog' })
    const nested = expectDefined(graph.createInstance(card.id, dialog.id, { name: 'Content' }))
    const caption = expectDefined(editor.getInstanceComponentPropertyDefinitions(nested.id)[0])
    editor.setNestedComponentPropertyExposure(dialog.id, nested.id, [caption.id])
    const instance = expectDefined(
      graph.createInstance(dialog.id, page, { name: 'Dialog instance' })
    )
    const exposed = expectDefined(editor.getInstanceComponentPropertyDefinitions(instance.id)[0])
    editor.setInstanceComponentProperty(instance.id, exposed.id, 'Continue')
    await Promise.resolve()
    let document = graph
    for (let round = 0; round < 2; round++) {
      document = await parseFigFile((await exportFigFile(document)).slice().buffer)
      reopened?.dispose()
      reopened = createEditor({ graph: document })
      const saved = expectDefined(
        [...document.getAllNodes()].find((node) => node.name === 'Dialog instance')
      )
      const controls = reopened.getInstanceComponentPropertyDefinitions(saved.id)
      expect(controls.map((item) => item.name)).toEqual(['Content / Action / Caption'])
      expect(reopened.getInstanceComponentPropertyValue(saved.id, controls[0])).toBe(
        round === 0 ? 'Continue' : 'Save'
      )
      reopened.setInstanceComponentProperty(saved.id, controls[0].id, 'Save')
      expect(reopened.getInstanceComponentPropertyValue(saved.id, controls[0])).toBe('Save')
      await Promise.resolve()
    }
  } finally {
    reopened?.dispose()
    editor.dispose()
  }
})
