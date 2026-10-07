import { expect, test } from 'bun:test'

import { expectDefined } from '#core-tests/helpers/assert'

import { nestedPropertyId } from '@open-pencil/scene-graph'

import { createEditor } from '#core/editor/create'

for (const forwarded of [false, true]) {
  test(`nested variant visibly changes size and survives parent sync (${forwarded ? 'forwarded' : 'direct'})`, async () => {
    const editor = createEditor()
    try {
      const graph = editor.graph
      const page = editor.state.currentPageId
      const small = graph.createNode('COMPONENT', page, { name: 'Icon', width: 24, height: 24 })
      graph.createNode('RECTANGLE', small.id, { width: 24, height: 24 })
      const large = expectDefined(editor.addVariant(small.id))
      graph.updateNode(large, { width: 48, height: 48 })
      graph.updateNode(expectDefined(graph.getChildren(large)[0]).id, { width: 48, height: 48 })
      const set = expectDefined(graph.getNode(small.parentId ?? ''))
      const variant = expectDefined(
        set.componentPropertyDefinitions.find((item) => item.type === 'VARIANT')
      )
      const parent = graph.createNode('COMPONENT', page, {
        name: 'Button',
        layoutMode: 'HORIZONTAL',
        primaryAxisSizing: 'HUG',
        counterAxisSizing: 'HUG'
      })
      const source = expectDefined(graph.createInstance(small.id, parent.id))
      editor.setNestedComponentPropertyExposure(parent.id, source.id, [variant.id])
      const instance = expectDefined(graph.createInstance(parent.id, page))
      await Promise.resolve()
      const nested = expectDefined(graph.getChildren(instance.id)[0])
      const exposed = expectDefined(editor.getInstanceComponentPropertyDefinitions(instance.id)[0])
      const value = expectDefined(graph.getNode(large)).componentPropertyValues[variant.name]
      editor.setInstanceComponentProperty(
        forwarded ? instance.id : nested.id,
        forwarded ? exposed.id : variant.id,
        value
      )
      expect(nested.width).toBe(48)
      expect(nested.height).toBe(48)
      graph.updateNode(parent.id, { cornerRadius: 4 })
      await Promise.resolve()
      expect(nested.width).toBe(48)
      expect(nested.height).toBe(48)
      expect(instance.width).toBe(48)
      expect(graph.getChildren(nested.id)[0]?.width).toBe(48)
      editor.undo.undo()
      await Promise.resolve()
      expect(nested.width).toBe(24)
      editor.undo.redo()
      await Promise.resolve()
      expect(nested.width).toBe(48)
    } finally {
      editor.dispose()
    }
  })
}

async function setup() {
  const editor = createEditor()
  const graph = editor.graph
  const page = editor.state.currentPageId
  const button = graph.createNode('COMPONENT', page, {
    name: 'Button',
    layoutMode: 'HORIZONTAL',
    primaryAxisSizing: 'HUG',
    counterAxisSizing: 'HUG'
  })
  const label = graph.createNode('TEXT', button.id, { name: 'Label', text: 'Button' })
  const text = expectDefined(editor.exposeComponentProperty(label.id, 'TEXT', 'Label'))
  const visible = expectDefined(editor.exposeComponentProperty(label.id, 'VISIBLE', 'Show label'))
  const alternate = expectDefined(editor.addVariant(button.id))
  const set = expectDefined(graph.getNode(button.parentId ?? ''))
  const variant = expectDefined(
    set.componentPropertyDefinitions.find((item) => item.type === 'VARIANT')
  )
  const card = graph.createNode('COMPONENT', page, { name: 'Card' })
  const nested = expectDefined(graph.createInstance(button.id, card.id, { name: 'Action' }))
  const second = expectDefined(graph.createInstance(button.id, card.id, { name: 'Other action' }))
  const instance = expectDefined(graph.createInstance(card.id, page))
  await Promise.resolve()
  return {
    editor,
    graph,
    button,
    label,
    text,
    visible,
    variant,
    alternate,
    card,
    nested,
    second,
    instance
  }
}

test('parent defaults inherit through nested instances while local overrides and unexposing preserve values', async () => {
  const { editor, graph, text, card, nested, instance, label } = await setup()
  try {
    editor.setNestedComponentPropertyExposure(card.id, nested.id, [text])
    const exposed = expectDefined(editor.getInstanceComponentPropertyDefinitions(instance.id)[0])
    editor.setInstanceComponentProperty(nested.id, text, 'Parent default')
    await Promise.resolve()
    const target = expectDefined(editor.getInstanceComponentPropertyTarget(instance.id, exposed.id))
    expect(editor.getInstanceComponentPropertyValue(instance.id, exposed)).toBe('Parent default')
    expect(graph.getChildren(target.instance.id)[0]?.text).toBe('Parent default')
    const newer = expectDefined(graph.createInstance(card.id, editor.state.currentPageId))
    editor.setInstanceComponentProperty(instance.id, exposed.id, 'Local override')
    editor.setInstanceComponentProperty(nested.id, text, 'Updated default')
    await Promise.resolve()
    expect(editor.getInstanceComponentPropertyValue(instance.id, exposed)).toBe('Local override')
    expect(graph.getChildren(target.instance.id)[0]?.text).toBe('Local override')
    expect(editor.getInstanceComponentPropertyValue(newer.id, exposed)).toBe('Updated default')
    expect(label.text).toBe('Button')
    editor.setNestedComponentPropertyExposure(card.id, nested.id, [])
    await Promise.resolve()
    expect(editor.getInstanceComponentPropertyDefinitions(instance.id)).toEqual([])
    expect(graph.getChildren(target.instance.id)[0]?.text).toBe('Local override')
    expect(
      editor.getInstanceComponentPropertyValue(
        nested.id,
        expectDefined(
          editor.getInstanceComponentPropertyDefinitions(nested.id).find((item) => item.id === text)
        )
      )
    ).toBe('Updated default')
    editor.undo.undo()
    expect(editor.getInstanceComponentPropertyDefinitions(instance.id)[0]?.id).toBe(exposed.id)
  } finally {
    editor.dispose()
  }
})

test('parent and nested attributes share an undoable order including nested variant selectors', async () => {
  const { editor, graph, text, variant, card, nested, instance } = await setup()
  try {
    const label = graph.createNode('TEXT', card.id, { name: 'Title', text: 'Title' })
    const title = expectDefined(editor.exposeComponentProperty(label.id, 'TEXT', 'Title'))
    editor.setNestedComponentPropertyExposure(card.id, nested.id, [text, variant.id])
    await Promise.resolve()
    const order = [
      nestedPropertyId(nested.id, variant.id),
      title,
      nestedPropertyId(nested.id, text)
    ]
    expect(editor.reorderExposedComponentProperties(card.id, order)).toBe(true)
    expect(
      editor.getInstanceComponentPropertyDefinitions(instance.id).map((item) => item.id)
    ).toEqual(order)
    editor.undo.undo()
    expect(editor.getInstanceComponentPropertyDefinitions(instance.id)[0]?.id).toBe(title)
    editor.undo.redo()
    expect(
      editor.getInstanceComponentPropertyDefinitions(instance.id).map((item) => item.id)
    ).toEqual(order)
    expect(editor.reorderExposedComponentProperties(card.id, [title, title, title])).toBe(false)
  } finally {
    editor.dispose()
  }
})

test('selectively exposes nested controls, keeps repeated instances independent, and supports undo', async () => {
  const { editor, graph, label, text, visible, card, nested, instance } = await setup()
  try {
    expect(editor.getInstanceComponentPropertyDefinitions(instance.id)).toEqual([])
    expect(editor.getNestedComponentPropertyCandidates(card.id)).toHaveLength(2)
    expect(editor.setNestedComponentPropertyExposure(card.id, nested.id, [text])).toBe(true)
    const exposed = expectDefined(editor.getInstanceComponentPropertyDefinitions(instance.id)[0])
    expect(exposed.name).toBe('Action / Label')
    expect(editor.getInstanceComponentPropertyDefinitions(instance.id)).toHaveLength(1)
    editor.undo.undo()
    expect(editor.getInstanceComponentPropertyDefinitions(instance.id)).toEqual([])
    editor.undo.redo()
    editor.setInstanceComponentProperty(instance.id, exposed.id, 'Continue')
    const target = expectDefined(editor.getInstanceComponentPropertyTarget(instance.id, exposed.id))
    expect(graph.getChildren(target.instance.id)[0]?.text).toBe('Continue')
    expect(label.text).toBe('Button')
    const other = expectDefined(
      graph.getChildren(instance.id).find((node) => node.name === 'Other action')
    )
    expect(graph.getChildren(other.id)[0]?.text).toBe('Button')
    await Promise.resolve()
    graph.updateNode(card.id, { cornerRadius: 12 })
    await Promise.resolve()
    expect(graph.getChildren(target.instance.id)[0]?.text).toBe('Continue')
    editor.undo.undo()
    expect(graph.getChildren(target.instance.id)[0]?.text).toBe('Button')
    editor.undo.redo()
    expect(graph.getChildren(target.instance.id)[0]?.text).toBe('Continue')
    editor.setNestedComponentPropertyExposure(card.id, nested.id, [visible])
    const exposedVisibility = expectDefined(
      editor.getInstanceComponentPropertyDefinitions(instance.id)[0]
    )
    editor.setInstanceComponentProperty(instance.id, exposedVisibility.id, 'false')
    expect(graph.getChildren(target.instance.id)[0]?.visible).toBe(false)
  } finally {
    editor.dispose()
  }
})

test('exposed nested variant selection keeps the source link through edits, synchronization and undo', async () => {
  const { editor, graph, button, text, variant, alternate, card, nested, instance } = await setup()
  try {
    editor.setNestedComponentPropertyExposure(card.id, nested.id, [variant.id])
    const exposed = expectDefined(editor.getInstanceComponentPropertyDefinitions(instance.id)[0])
    const alternative = expectDefined(graph.getNode(alternate)).componentPropertyValues[
      variant.name
    ]
    editor.setInstanceComponentProperty(instance.id, exposed.id, alternative)
    let target = expectDefined(editor.getInstanceComponentPropertyTarget(instance.id, exposed.id))
    expect(target.instance.componentId).toBe(alternate)
    expect(editor.getInstanceComponentPropertyValue(instance.id, exposed)).toBe(alternative)
    graph.updateNode(card.id, { cornerRadius: 12 })
    await Promise.resolve()
    target = expectDefined(editor.getInstanceComponentPropertyTarget(instance.id, exposed.id))
    expect(target.instance.componentId).toBe(alternate)
    editor.undo.undo()
    expect(editor.getInstanceComponentPropertyValue(instance.id, exposed)).toBe(
      button.componentPropertyValues[variant.name]
    )
    editor.undo.redo()
    expect(editor.getInstanceComponentPropertyValue(instance.id, exposed)).toBe(alternative)
    editor.undo.undo()
    target = expectDefined(editor.getInstanceComponentPropertyTarget(instance.id, exposed.id))
    editor.setInstanceComponentProperty(target.instance.id, text, 'Edited after undo')
    expect(graph.getChildren(target.instance.id)[0]?.text).toBe('Edited after undo')
  } finally {
    editor.dispose()
  }
})

test('forwards selected properties through another level of nesting without exposing its other controls', async () => {
  const { editor, graph, text, visible, card, nested } = await setup()
  try {
    editor.setNestedComponentPropertyExposure(card.id, nested.id, [text, visible])
    const dialog = graph.createNode('COMPONENT', editor.state.currentPageId, { name: 'Dialog' })
    const cardInDialog = expectDefined(graph.createInstance(card.id, dialog.id, { name: 'Card' }))
    const forwarded = expectDefined(
      editor
        .getInstanceComponentPropertyDefinitions(cardInDialog.id)
        .find((item) => item.type === 'TEXT')
    )
    editor.setNestedComponentPropertyExposure(dialog.id, cardInDialog.id, [forwarded.id])
    const dialogInstance = expectDefined(
      graph.createInstance(dialog.id, editor.state.currentPageId)
    )
    await Promise.resolve()
    const controls = editor.getInstanceComponentPropertyDefinitions(dialogInstance.id)
    expect(controls.map((item) => item.name)).toEqual(['Card / Action / Label'])
    const destination = createEditor()
    try {
      editor.select([dialog.id])
      const payload = await editor.prepareCopy()
      await destination.pasteSnapshot(expectDefined(payload.snapshot))
      const pasted = expectDefined(destination.getSelectedNodes()[0])
      expect(
        destination.getInstanceComponentPropertyDefinitions(pasted.id).map((item) => item.name)
      ).toEqual(['Card / Action / Label'])
    } finally {
      destination.dispose()
    }
    editor.setInstanceComponentProperty(dialogInstance.id, controls[0].id, 'Save')
    expect(editor.getInstanceComponentPropertyValue(dialogInstance.id, controls[0])).toBe('Save')
    graph.updateNode(dialog.id, { cornerRadius: 16 })
    await Promise.resolve()
    expect(editor.getInstanceComponentPropertyValue(dialogInstance.id, controls[0])).toBe('Save')
  } finally {
    editor.dispose()
  }
})
