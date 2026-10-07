import { expect, test } from 'bun:test'

import { exportFigFile, initCodec, parseFigFile } from '@open-pencil/core'
import { createEditor } from '@open-pencil/core/editor'

test('variant defaults remap property IDs and swap targets through repeated saves', async () => {
  await initCodec()
  const editor = createEditor()
  let reopened: ReturnType<typeof createEditor> | undefined
  try {
    const page = editor.state.currentPageId
    const component = editor.graph.createNode('COMPONENT', page, { name: 'Button' })
    const label = editor.graph.createNode('TEXT', component.id, { name: 'Label', text: 'Base' })
    const badge = editor.graph.createNode('FRAME', component.id, { name: 'Badge' })
    const icon = editor.graph.createNode('COMPONENT', page, { name: 'Icon' })
    const alternate = editor.graph.createNode('COMPONENT', page, { name: 'Alternate' })
    const nested = editor.graph.createInstance(icon.id, component.id)
    if (!nested) throw new Error('No icon')
    const text = editor.exposeComponentProperty(label.id, 'TEXT', 'Label')
    const visible = editor.exposeComponentProperty(badge.id, 'VISIBLE', 'Badge')
    const swap = editor.exposeComponentProperty(nested.id, 'INSTANCE_SWAP', 'Icon')
    const variant = editor.addVariant(component.id)
    if (!text || !visible || !swap || !variant) throw new Error('Missing properties')
    editor.setComponentPropertyVariantDefault(variant, text, 'Alternative')
    editor.setComponentPropertyVariantDefault(variant, visible, 'false')
    editor.setComponentPropertyVariantDefault(variant, swap, alternate.id)
    editor.graph.createInstance(variant, page, { name: 'Variant instance' })
    await Promise.resolve()
    let graph = editor.graph
    for (let round = 0; round < 2; round++) {
      const bytes = await exportFigFile(graph)
      graph = await parseFigFile(bytes.buffer as ArrayBuffer)
      reopened?.dispose()
      reopened = createEditor({ graph })
      const instance = [...graph.getAllNodes()].find(
        (node) => node.name === 'Variant instance' && node.type === 'INSTANCE'
      )
      if (!instance) throw new Error('Missing reopened instance')
      const definitions = reopened.getInstanceComponentPropertyDefinitions(instance.id)
      expect(definitions.find((definition) => definition.name === 'Label')?.defaultValue).toBe(
        'Alternative'
      )
      expect(definitions.find((definition) => definition.name === 'Badge')?.defaultValue).toBe(
        'false'
      )
      const iconId = definitions.find((definition) => definition.name === 'Icon')?.defaultValue
      expect(graph.getNode(iconId ?? '')?.name).toBe('Alternate')
    }
  } finally {
    reopened?.dispose()
    editor.dispose()
  }
}, 30_000)

test('manually exposed properties, bindings and instance values survive save and reopen', async () => {
  await initCodec()
  const editor = createEditor()
  const pageId = editor.state.currentPageId
  const component = editor.graph.createNode('COMPONENT', pageId, { name: 'Authored button' })
  const label = editor.graph.createNode('TEXT', component.id, { name: 'Caption', text: 'Default' })
  const badge = editor.graph.createNode('FRAME', component.id, { name: 'Badge' })
  const icon = editor.graph.createNode('COMPONENT', pageId, { name: 'Source icon' })
  const alternateIcon = editor.graph.createNode('COMPONENT', pageId, { name: 'Alternate icon' })
  const nested = editor.graph.createInstance(icon.id, component.id)
  if (!nested) throw new Error('Expected nested icon')
  const textId = editor.exposeComponentProperty(label.id, 'TEXT', 'Caption')
  const visibleId = editor.exposeComponentProperty(badge.id, 'VISIBLE', 'Show badge')
  const swapId = editor.exposeComponentProperty(nested.id, 'INSTANCE_SWAP', 'Icon')
  if (!textId || !visibleId || !swapId) throw new Error('Expected exposed properties')
  const instance = editor.graph.createInstance(component.id, pageId, { name: 'Authored instance' })
  if (!instance) throw new Error('Expected instance')
  editor.setInstanceComponentProperty(instance.id, textId, 'Saved caption')
  editor.setInstanceComponentProperty(instance.id, visibleId, 'false')
  editor.setInstanceComponentProperty(instance.id, swapId, alternateIcon.id)
  await Promise.resolve()
  const bytes = await exportFigFile(editor.graph)
  const graph = await parseFigFile(bytes.buffer as ArrayBuffer)
  const reopened = createEditor({ graph })
  const source = [...graph.getAllNodes()].find(
    (node) => node.name === 'Authored button' && node.type === 'COMPONENT'
  )
  const saved = [...graph.getAllNodes()].find(
    (node) => node.name === 'Authored instance' && node.type === 'INSTANCE'
  )
  if (!source || !saved) throw new Error('Expected reopened component and instance')
  const definitions = reopened.getInstanceComponentPropertyDefinitions(saved.id)
  expect(definitions.map((item) => [item.name, item.type])).toEqual([
    ['Caption', 'TEXT'],
    ['Show badge', 'BOOLEAN'],
    ['Icon', 'INSTANCE_SWAP']
  ])
  for (const definition of definitions) {
    expect(reopened.getComponentPropertyBindings(source.id, definition.id)).toHaveLength(1)
  }
  const children = graph.getChildren(saved.id)
  expect(children.find((node) => node.name === 'Caption')?.text).toBe('Saved caption')
  expect(children.find((node) => node.name === 'Badge')?.visible).toBe(false)
  expect(children.find((node) => node.type === 'INSTANCE')?.name).toBe('Alternate icon')
}, 30_000)
